import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, onSnapshot, query, where, updateDoc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Award, Calendar, CheckCircle, ChevronDown, ChevronRight, Crown, Edit, Eye, EyeOff, LogOut, Plus, RefreshCw, Send, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper Functions ---
const formatDate = (date) => {
  if (!date) return 'N/A';
  // Check if it's a Firebase Timestamp
  if (date.toDate) {
    return date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  // Assume it's a string or Date object
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const generateCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};


// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'competition'
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><RefreshCw className="animate-spin mr-2" /> Loading...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }
  
  const navigateToCompetition = (id) => {
    setSelectedCompetitionId(id);
    setView('competition');
  };

  const navigateToDashboard = () => {
    setSelectedCompetitionId(null);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header user={user} onNavigateToDashboard={navigateToDashboard} />
      <main className="p-4 sm:p-6 md:p-8">
        {view === 'dashboard' && <Dashboard user={user} onNavigateToCompetition={navigateToCompetition} />}
        {view === 'competition' && <CompetitionView user={user} competitionId={selectedCompetitionId} onBack={navigateToDashboard} />}
      </main>
    </div>
  );
}

// --- Components ---

function Header({ user, onNavigateToDashboard }) {
  return (
    <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
      <h1 onClick={onNavigateToDashboard} className="text-2xl font-bold text-indigo-400 cursor-pointer hover:text-indigo-300 transition-colors">
        Competition Hub
      </h1>
      <div className="flex items-center space-x-4">
        <span className="text-gray-300 hidden sm:block">Welcome, {user.displayName || user.email}</span>
        <button onClick={() => signOut(auth)} className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          <LogOut size={18} className="mr-2" /> Logout
        </button>
      </div>
    </header>
  );
}

function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (!displayName) {
                    setError('Display name is required.');
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName });
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-indigo-400 mb-6">{isLogin ? 'Login' : 'Sign Up'}</h2>
                {error && <p className="bg-red-900 border border-red-700 text-red-300 text-sm p-3 rounded-lg mb-4">{error}</p>}
                <form onSubmit={handleAuth} className="space-y-6">
                    {!isLogin && (
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Display Name"
                            className="w-full bg-gray-700 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full bg-gray-700 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                     <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-gray-700 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                           {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-lg transition-colors">
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>
                <p className="text-center mt-6 text-gray-400">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 hover:underline ml-2 font-semibold">
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
}

function Dashboard({ user, onNavigateToCompetition }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'competitions'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const comps = [];
            querySnapshot.forEach((doc) => {
                comps.push({ id: doc.id, ...doc.data() });
            });
            setCompetitions(comps);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateCompetition = async (formData) => {
        if (!formData.name || !formData.startDate || !formData.endDate) {
            alert('Please fill in name, start date, and end date.');
            return;
        }
        try {
            const accessCode = formData.accessType === 'code' ? generateCode() : null;
            await addDoc(collection(db, 'competitions'), {
                ...formData,
                creatorId: user.uid,
                adminIds: [user.uid],
                createdAt: serverTimestamp(),
                accessCode,
                participantCount: 0,
            });
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error creating competition: ", error);
            alert('Failed to create competition.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-200">Competitions</h2>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <Plus size={20} className="mr-2" /> Create Competition
                </button>
            </div>
            {loading ? <p>Loading competitions...</p> :
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {competitions.map(comp => (
                        <CompetitionCard key={comp.id} competition={comp} onSelect={() => onNavigateToCompetition(comp.id)} />
                    ))}
                </div>
            }
            {showCreateModal && <CreateCompetitionModal user={user} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateCompetition} />}
        </div>
    );
}

function CompetitionCard({ competition, onSelect }) {
    return (
        <div className="bg-gray-800 rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:ring-2 hover:ring-indigo-500 transition-all duration-300 overflow-hidden transform hover:-translate-y-1">
            <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">{competition.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{competition.description}</p>
                <div className="flex items-center text-gray-400 text-sm mb-4">
                    <Calendar size={16} className="mr-2" />
                    <span>{formatDate(competition.startDate)} - {formatDate(competition.endDate)}</span>
                </div>
                 <div className="flex items-center text-gray-400 text-sm">
                    <Users size={16} className="mr-2" />
                    <span>{competition.participantCount || 0} participants</span>
                </div>
            </div>
            <div className="bg-gray-700/50 px-6 py-3">
                 <button onClick={onSelect} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    View Competition
                </button>
            </div>
        </div>
    );
}

function CreateCompetitionModal({ user, onClose, onSubmit }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '', description: '', startDate: '', endDate: '',
        accessType: 'open',
        teamConfig: { mode: 'individual', creation: 'admin', allowMultipleTeams: false, scoreCalculation: 'sum' },
        tasks: [],
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleTeamConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            teamConfig: {
                ...prev.teamConfig,
                [name]: type === 'checkbox' ? checked : value,
            }
        }));
    };
    
    const addTask = () => {
        setFormData(prev => ({
            ...prev,
            tasks: [...prev.tasks, { id: generateCode(8), name: '', points: 10, frequency: 'once', isUserDefinedGoal: false, checkinDueDateOffset: 2 }]
        }));
    };
    
    const handleTaskChange = (index, e) => {
        const { name, value, type, checked } = e.target;
        const newTasks = [...formData.tasks];
        newTasks[index] = { ...newTasks[index], [name]: type === 'checkbox' ? checked : value };
        setFormData(prev => ({ ...prev, tasks: newTasks }));
    };

    const removeTask = (index) => {
        setFormData(prev => ({ ...prev, tasks: formData.tasks.filter((_, i) => i !== index) }));
    };

    const handleSubmit = () => {
        onSubmit(formData);
    };
    
    const renderStep = () => {
        switch(step) {
            case 1: // Basic Info
                return (
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-white">Competition Details</h3>
                        <input type="text" name="name" placeholder="Competition Name" value={formData.name} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded mb-3" />
                        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded mb-3"></textarea>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Access</label>
                            <select name="accessType" value={formData.accessType} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded">
                                <option value="open">Open to All</option>
                                <option value="code">Require Registration Code</option>
                                <option value="link">Join by Link Only</option>
                            </select>
                        </div>
                    </div>
                );
            case 2: // Team Configuration
                 return (
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-white">Team Setup</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Participation Mode</label>
                                <select name="mode" value={formData.teamConfig.mode} onChange={handleTeamConfigChange} className="w-full bg-gray-700 p-2 rounded">
                                    <option value="individual">Individual</option>
                                    <option value="team">Team</option>
                                    <option value="mixed">Mixed (Participants can either compete individually or as a team)</option>
                                </select>
                            </div>
                            {formData.teamConfig.mode !== 'individual' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Team Creation</label>
                                        <select name="creation" value={formData.teamConfig.creation} onChange={handleTeamConfigChange} className="w-full bg-gray-700 p-2 rounded">
                                            <option value="admin">Admins create teams</option>
                                            <option value="participant">Participants can create their own teams</option>
                                        </select>
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Team Score Calculation</label>
                                        <select name="scoreCalculation" value={formData.teamConfig.scoreCalculation} onChange={handleTeamConfigChange} className="w-full bg-gray-700 p-2 rounded">
                                            <option value="sum">Sum of member scores</option>
                                            <option value="average">Average of member scores</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center">
                                        <input type="checkbox" id="allowMultipleTeams" name="allowMultipleTeams" checked={formData.teamConfig.allowMultipleTeams} onChange={handleTeamConfigChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <label htmlFor="allowMultipleTeams" className="ml-2 block text-sm text-gray-300">Allow participants to join more than one team</label>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            case 3: // Tasks & Scoring
                return (
                     <div>
                        <h3 className="text-xl font-semibold mb-4 text-white">Tasks & Scoring</h3>
                        <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                            {formData.tasks.map((task, index) => (
                                <div key={task.id} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
                                     <div className="flex justify-between items-center mb-2">
                                        <p className="font-semibold text-indigo-300">Task #{index + 1}</p>
                                        <button onClick={() => removeTask(index)} className="text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                                    </div>
                                    <input type="text" name="name" placeholder="Task Name" value={task.name} onChange={(e) => handleTaskChange(index, e)} className="w-full bg-gray-600 p-2 rounded mb-2" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" name="points" placeholder="Points" value={task.points} onChange={(e) => handleTaskChange(index, e)} className="w-full bg-gray-600 p-2 rounded" />
                                        <select name="frequency" value={task.frequency} onChange={(e) => handleTaskChange(index, e)} className="w-full bg-gray-600 p-2 rounded">
                                            <option value="once">Once</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                        </select>
                                    </div>
                                    <div className="mt-2">
                                         <label className="text-sm text-gray-400">Days to check-in after period ends:</label>
                                        <input type="number" name="checkinDueDateOffset" placeholder="e.g., 2" value={task.checkinDueDateOffset} onChange={(e) => handleTaskChange(index, e)} className="w-full bg-gray-600 p-2 rounded mt-1" />
                                    </div>
                                     <div className="flex items-center mt-2">
                                        <input type="checkbox" id={`userDefined-${index}`} name="isUserDefinedGoal" checked={task.isUserDefinedGoal} onChange={(e) => handleTaskChange(index, e)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <label htmlFor={`userDefined-${index}`} className="ml-2 block text-sm text-gray-300">This is a user-defined goal</label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={addTask} className="mt-4 w-full flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                           <Plus size={18} className="mr-2" /> Add Task
                        </button>
                    </div>
                );
            default: return null;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Create New Competition</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
                </div>
                <div className="p-6">
                    {/* Stepper UI */}
                    <div className="flex justify-between items-center mb-6">
                        {['Details', 'Teams', 'Tasks'].map((name, index) => (
                           <React.Fragment key={name}>
                             <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= index + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                    {index + 1}
                                </div>
                                <p className={`mt-1 text-sm ${step >= index + 1 ? 'text-indigo-300' : 'text-gray-400'}`}>{name}</p>
                            </div>
                            {index < 2 && <div className={`flex-1 h-1 mx-2 ${step > index + 1 ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>}
                           </React.Fragment>
                        ))}
                    </div>
                    {renderStep()}
                </div>
                <div className="p-6 bg-gray-800/50 border-t border-gray-700 flex justify-between rounded-b-xl">
                    <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        Back
                    </button>
                    {step < 3 ? (
                        <button onClick={() => setStep(s => Math.min(3, s + 1))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">
                            Next
                        </button>
                    ) : (
                        <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg">
                            Create Competition
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


function CompetitionView({ user, competitionId, onBack }) {
    const [competition, setCompetition] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [teams, setTeams] = useState([]);
    const [discussion, setDiscussion] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [userEntries, setUserEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isParticipant, setIsParticipant] = useState(false);
    
    const isCreator = useMemo(() => competition?.creatorId === user.uid, [competition, user]);
    const isAdmin = useMemo(() => competition?.adminIds?.includes(user.uid), [competition, user]);

    useEffect(() => {
        if (!competitionId) return;
        setLoading(true);
        const unsubCompetition = onSnapshot(doc(db, 'competitions', competitionId), (doc) => {
            if(doc.exists()){
                const compData = { id: doc.id, ...doc.data() };
                setCompetition(compData);
                setIsParticipant(compData.participantIds?.includes(user.uid));
            } else {
                setCompetition(null); // Or handle not found
            }
            setLoading(false);
        });
        
        const unsubParticipants = onSnapshot(collection(db, 'competitions', competitionId, 'participants'), (snapshot) => {
             setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubTeams = onSnapshot(collection(db, 'competitions', competitionId, 'teams'), (snapshot) => {
            setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Other listeners for discussion, announcements, entries etc would go here
        
        return () => {
            unsubCompetition();
            unsubParticipants();
            unsubTeams();
        };

    }, [competitionId, user.uid]);

    const handleJoin = async () => {
        try {
            const competitionRef = doc(db, 'competitions', competitionId);
            const participantRef = doc(db, 'competitions', competitionId, 'participants', user.uid);
            
            await setDoc(participantRef, {
                displayName: user.displayName,
                joinedAt: serverTimestamp(),
                score: 0
            });
            
            await updateDoc(competitionRef, {
                participantIds: arrayUnion(user.uid),
                participantCount: (competition.participantCount || 0) + 1
            });
            
        } catch (error) {
            console.error("Error joining competition: ", error);
            alert("Failed to join.");
        }
    };
    
    if (loading) return <div className="text-center p-8"><RefreshCw className="animate-spin inline-block" /> Loading Competition...</div>;
    if (!competition) return <div className="text-center p-8">Competition not found. <button onClick={onBack} className="text-indigo-400 underline">Go Back</button></div>;

    return (
        <div className="max-w-7xl mx-auto">
            <button onClick={onBack} className="flex items-center text-indigo-400 hover:text-indigo-300 mb-4">
                <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            </button>
            
            <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-white">{competition.name}</h2>
                        <p className="text-gray-400 mt-1">{competition.description}</p>
                         <div className="flex items-center text-gray-400 text-sm mt-2">
                            <Calendar size={16} className="mr-2" />
                            <span>{formatDate(competition.startDate)} to {formatDate(competition.endDate)}</span>
                        </div>
                    </div>
                    <div>
                        {!isParticipant && (
                            <button onClick={handleJoin} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Join Competition</button>
                        )}
                        {isAdmin && <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-800 text-indigo-200"><Shield size={14} className="mr-1.5"/> Admin</span>}
                    </div>
                </div>
            </div>

            {/* Main content tabs would go here */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Tasks Component Placeholder */}
                    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                         <h3 className="text-xl font-bold text-white mb-4">Your Tasks</h3>
                         <div className="space-y-3">
                             {competition.tasks.map(task => (
                                <div key={task.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-200">{task.name}</p>
                                        <p className="text-sm text-gray-400">{task.frequency} | <span className="text-yellow-400">{task.points} points</span></p>
                                    </div>
                                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-lg text-sm">Log Entry</button>
                                </div>
                             ))}
                         </div>
                    </div>
                    {/* Discussion Board Placeholder */}
                    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                         <h3 className="text-xl font-bold text-white mb-4">General Discussion</h3>
                         {/* Chat interface */}
                    </div>
                </div>
                <div className="space-y-6">
                    {/* Leaderboard Component */}
                    <Leaderboard participants={participants} teams={teams} teamConfig={competition.teamConfig} />
                    {/* Teams Component Placeholder */}
                    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Teams</h3>
                         {/* Team list and create/join controls */}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Leaderboard({ participants, teams, teamConfig }) {
    const [activeTab, setActiveTab] = useState('individual');
    
    const sortedParticipants = useMemo(() => {
        return [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [participants]);

    const sortedTeams = useMemo(() => {
         // Team score calculation would be more complex in reality, based on member scores
        return [...teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [teams]);

    const hasTeams = teamConfig.mode !== 'individual';

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center"><Award size={22} className="mr-2 text-yellow-400"/>Leaderboard</h3>
            {hasTeams && (
                <div className="flex border-b border-gray-700 mb-4">
                    <button onClick={() => setActiveTab('individual')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'individual' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>Individuals</button>
                    <button onClick={() => setActiveTab('team')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'team' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>Teams</button>
                </div>
            )}
            
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {activeTab === 'individual' ? 
                    sortedParticipants.map((p, index) => (
                        <li key={p.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <span className="text-lg font-bold w-8 text-center text-gray-400">{index + 1}</span>
                                <span className="ml-3 font-semibold text-gray-200">{p.displayName}</span>
                                {index === 0 && <Crown size={16} className="ml-2 text-yellow-400"/>}
                            </div>
                            <span className="font-bold text-indigo-300">{p.score || 0} pts</span>
                        </li>
                    )) : 
                    sortedTeams.map((t, index) => (
                         <li key={t.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                            <div className="flex items-center">
                                <span className="text-lg font-bold w-8 text-center text-gray-400">{index + 1}</span>
                                <span className="ml-3 font-semibold text-gray-200">{t.name}</span>
                                {index === 0 && <Crown size={16} className="ml-2 text-yellow-400"/>}
                            </div>
                            <span className="font-bold text-indigo-300">{t.score || 0} pts</span>
                        </li>
                    ))
                }
            </ul>
        </div>
    );
}
