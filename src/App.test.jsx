import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Firebase mocks -------------------------------------------------------
// Refs are plain objects carrying their Firestore path; onSnapshot serves data
// from `store` keyed by that path.
const store = vi.hoisted(() => ({ docs: {}, collections: {}, authUser: null, authCallback: null }));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, cb) => {
    store.authCallback = cb;
    cb(store.authUser);
    return vi.fn();
  }),
  createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'new-user' } })),
  signInWithEmailAndPassword: vi.fn(async () => ({})),
  signOut: vi.fn(async () => {}),
  updateProfile: vi.fn(async () => {})
}));

const callable = vi.hoisted(() => vi.fn(async () => ({ data: {} })));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => callable)
}));

vi.mock('firebase/firestore', () => {
  const makeDoc = (path, data) => ({
    id: path.split('/').pop(),
    exists: () => data !== undefined,
    data: () => data
  });
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
    query: vi.fn((ref) => ({ ...ref })),
    where: vi.fn(),
    onSnapshot: vi.fn((ref, cb) => {
      if (ref.type === 'doc') {
        cb(makeDoc(ref.path, store.docs[ref.path]));
      } else {
        const docs = Object.entries(store.collections[ref.path] || {}).map(([id, data]) =>
          makeDoc(`${ref.path}/${id}`, data)
        );
        cb({ docs, forEach: (fn) => docs.forEach(fn) });
      }
      return vi.fn();
    }),
    addDoc: vi.fn(async () => ({ id: 'new' })),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    arrayUnion: vi.fn((...values) => ({ arrayUnion: values })),
    increment: vi.fn((n) => ({ increment: n })),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP')
  };
});

import * as auth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import App from './App';

const user = { uid: 'u1', displayName: 'Alice', email: 'alice@example.com' };

const competition = {
  name: 'Spring Challenge',
  description: 'Get moving',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  adminIds: ['u1'],
  participantIds: ['u1'],
  participantCount: 2,
  teamConfig: { mode: 'team' },
  tasks: [
    { id: 'd1', name: 'Stretch', points: '5', frequency: 'daily' },
    { id: 'w1', name: 'Long walk', points: '20', frequency: 'weekly' },
    { id: 'o1', name: 'Run a 5k', points: '50', frequency: 'once' }
  ]
};

const openCompetition = async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'View Competition' }));
  await screen.findByText('Your Tasks');
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  vi.clearAllMocks();
  store.authUser = null;
  store.docs = { 'competitions/c1': competition };
  store.collections = {
    competitions: { c1: competition },
    'competitions/c1/participants': {
      u1: { displayName: 'Alice', score: 30 },
      u2: { displayName: 'Bob', score: 70 }
    },
    'competitions/c1/teams': {
      t1: { name: 'Red', score: 10 },
      t2: { name: 'Blue', score: 40 }
    },
    'competitions/c1/entries': {}
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App when signed out', () => {
  it('shows the login form and signs in', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() =>
      expect(auth.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'secret')
    );
  });

  it('shows sign-in errors', async () => {
    auth.signInWithEmailAndPassword.mockRejectedValueOnce(new Error('Bad password'));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Bad password')).toBeInTheDocument();
  });

  it('creates an account with a display name', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    fireEvent.change(screen.getByPlaceholderText('Display Name'), { target: { value: 'Zed' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'z@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith({ uid: 'new-user' }, { displayName: 'Zed' }));
  });
});

describe('App when signed in', () => {
  beforeEach(() => {
    store.authUser = user;
  });

  it('lists competitions on the dashboard', () => {
    render(<App />);
    expect(screen.getByText('Welcome, Alice')).toBeInTheDocument();
    expect(screen.getByText('Spring Challenge')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2025 - Dec 31, 2025')).toBeInTheDocument();
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  it('signs out', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('creates a competition with an access code', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Create Competition/ }));
    fireEvent.change(screen.getByPlaceholderText('Competition Name'), { target: { value: 'New Comp' } });
    fireEvent.change(document.querySelector('input[name="startDate"]'), { target: { value: '2025-02-01' } });
    fireEvent.change(document.querySelector('input[name="endDate"]'), { target: { value: '2025-03-01' } });
    fireEvent.change(document.querySelector('select[name="accessType"]'), { target: { value: 'code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /Add Task/ }));
    fireEvent.change(screen.getByPlaceholderText('Task Name'), { target: { value: 'Push-ups' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Competition' }).at(-1));

    await waitFor(() => expect(firestore.addDoc).toHaveBeenCalledTimes(1));
    const data = firestore.addDoc.mock.calls[0][1];
    expect(data).toMatchObject({
      name: 'New Comp',
      startDate: '2025-02-01',
      endDate: '2025-03-01',
      creatorId: 'u1',
      adminIds: ['u1'],
      participantCount: 0
    });
    expect(data.accessCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({ name: 'Push-ups', points: 10, frequency: 'once' });
    expect(data.tasks[0].id).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('shows the competition with a leaderboard sorted by score', async () => {
    await openCompetition();
    expect(screen.getByRole('heading', { name: 'Spring Challenge' })).toBeInTheDocument();
    expect(screen.getByText('Total Points: 30')).toBeInTheDocument();
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Bob');
    expect(names[1]).toContain('Alice');

    fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
    const teams = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(teams[0]).toContain('Blue');
    expect(teams[1]).toContain('Red');
  });

  it('records a daily task completion through the scoring function', async () => {
    await openCompetition();
    expect(screen.getByText('Stretch')).toBeInTheDocument();
    const checkbox = screen.getByText('Stretch').closest('div.flex').querySelector('button');
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(callable).toHaveBeenCalledWith(
      expect.objectContaining({ competitionId: 'c1', taskId: 'd1', date: '2025-01-15', completed: true })
    );
    // The client never sends points or writes scores itself.
    expect(callable.mock.calls[0][0]).not.toHaveProperty('points');
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('removes a one-and-done completion through the scoring function', async () => {
    store.collections['competitions/c1/entries'] = { u1_o1: { taskId: 'o1', date: '2025-01-10' } };
    await openCompetition();
    fireEvent.click(screen.getByRole('button', { name: 'ONE-AND-DONE' }));
    const checkbox = screen.getByText('Run a 5k').closest('div.flex').querySelector('button');
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(callable).toHaveBeenCalledWith(
      expect.objectContaining({ competitionId: 'c1', taskId: 'o1', completed: false })
    );
  });

  it('tells the user when the scoring function fails', async () => {
    callable.mockRejectedValueOnce(new Error('permission-denied'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openCompetition();
    const checkbox = screen.getByText('Stretch').closest('div.flex').querySelector('button');
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(alertSpy).toHaveBeenCalledWith('Failed to update task.');
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('shows weekly tasks in their tab', async () => {
    await openCompetition();
    fireEvent.click(screen.getByRole('button', { name: 'WEEKLY TASKS' }));
    expect(screen.getByText('Long walk')).toBeInTheDocument();
    expect(screen.getByText('Year 2025, Week 3')).toBeInTheDocument();
  });

  it('joins a competition', async () => {
    store.docs['competitions/c1'] = { ...competition, participantIds: [] };
    await openCompetition();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Competition' }));
    });
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'competitions/c1/participants/u1' }),
      expect.objectContaining({ displayName: 'Alice', score: 0 })
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'competitions/c1' }), {
      participantIds: { arrayUnion: ['u1'] },
      participantCount: { increment: 1 }
    });
  });

  it('returns to the dashboard', async () => {
    await openCompetition();
    fireEvent.click(screen.getByRole('button', { name: /Back to Dashboard/ }));
    expect(screen.getByRole('heading', { name: 'Competitions' })).toBeInTheDocument();
  });
});
