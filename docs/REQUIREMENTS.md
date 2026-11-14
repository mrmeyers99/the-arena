# The Arena — Requirements

> Status: Draft v0.1 · Last updated: 2026-11-14

## 1. Purpose and vision

The Arena is a web app for running **time-boxed, points-based challenge competitions**. Participants earn points by completing tasks (daily habits, weekly challenges, one-time achievements) and compete individually and/or as teams on live leaderboards.

The first customer is **StrenGames**, a member-organized competition run a few times a year by The Strenuous Life (TSL). Today it runs on a Google Form plus a Google Sheets scorecard. The Arena should replace that manual process end to end.

At the same time, the app should stay **generic**. Nothing StrenGames-specific (task names, point values, team rules) is hard-coded. Any group should be able to configure its own competition. StrenGames serves as the reference configuration and acceptance test (see §7).

### Goals

1. Remove the manual spreadsheet work: form maintenance, formulas and pivots, roster wrangling.
2. Give participants instant feedback: their own score, their team's score and the standings.
3. Make running a competition repeatable: clone last season's setup, with built-in reminders.
4. Support StrenGames' rules fully, while letting other groups use different rules.

### Non-goals (for now)

- Integrating with TSL's forum or membership system (accounts are standalone).
- Payments, prizes or fulfilment.
- Native mobile apps. A mobile-friendly web app is enough.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Competition** | One run of a challenge (e.g. "StrenGames VI"), with a start date, an end date, tasks and participants. |
| **Task** | Something a participant can do to earn points (e.g. "Daily physical activity, 10 pts"). |
| **Task type** | How a task scores: per period, once, best value, and so on (see §5.3). |
| **Period** | The time window a recurring task scores in: a **day** or a **week**. |
| **Entry** | A participant's record that they completed a task, for a given period. |
| **Logging deadline** | The last moment an entry for a period can be created or changed: period end + *N* days. |
| **Team** | A group of participants whose scores combine into a team score. |
| **Captain** | The team member who manages a team's roster (by default, whoever created the team). |
| **Admin / Organizer** | A user who manages a competition. The creator is the first admin. |
| **Official team** | A team that meets the competition's minimum size and is ranked on the main team leaderboard. |

---

## 3. Current manual process (StrenGames)

This section records how StrenGames runs today, so the app's requirements trace back to real needs.

### 3.1 Format

- A 6-week competition, open to all TSL members.
- People take part as individuals. They can also join one or more teams.
- A perfect score is **3000 points**.

### 3.2 Scoring rules (StrenGames VI)

| Task | Points | Frequency | Notes |
|---|---|---|---|
| Daily physical activity | 10 | per day | |
| Daily good deed | 10 | per day | |
| Agon | 80 | per week | An Agon that is also a badge requirement can't count as both. |
| Badge requirement | 80 | per week | Must be one not previously completed. The participant names which requirement. Community badges are allowed. |
| AGFT (fitness test) | up to 500 | best of many | Can be attempted many times; only the best score counts, once. Score comes from an external scoring table. |
| TSL meet-up | 200 | once | An in-person meetup where nobody else shows up still counts if a report is posted. |
| Personal goal | 250 | once | A "SMARTER" goal that must be **declared by the end of week 1**, or the category scores 0. Evidence is posted when completed. |
| Bonus challenge | 250 | once | **Revealed on day one** (e.g. 12 hours of community service over 6 weeks). Can "double dip" with good deeds. |

### 3.3 Registration

- A Google Form sign-up, open from about 2–3 weeks before the start until 5–7 days before (so team rosters can be confirmed).
- People sign up as individuals by default. They can optionally pick an existing team or type a new team name.
- The first person to enter a team name becomes its **team leader (captain)** and can approve or reject join requests.
- The form can be resubmitted to change details.

### 3.4 Weekly check-in

- A Google Form submitted once per week, due a fixed time after the week ends (e.g. "Wednesday 6:00 am ET" or "Thursday midnight GMT-10"). **Late submissions are not counted.**
- Fields: name (picked from a ~200-entry dropdown), the week being reported, days of physical activity (0–7), days of good deeds (0–7), Agon done (Y/N), badge requirement done (Y/N), which badge requirement (text), best AGFT score (number), meetup attended (Y/N), personal goal fully complete (Y/N), bonus challenge complete (Y/N).
- If a person submits more than once for the same week, **only the latest submission counts**.

### 3.5 Scorecard spreadsheet

The scorecard sheet uses `IMPORTRANGE`, `MAXIFS`, `SUMIFS`, `COUNTIFS`, `SORT` and `FILTER`:

1. **Latest Responses:** flags the newest submission per (name, week).
2. **Individual – Scores:** per person, using latest submissions only:
   - PA and good deeds = Σ days × 10
   - Agon and badge = count of "Yes" weeks × 80
   - AGFT = MAX
   - Meetup, personal goal and bonus = points if *any* week says "Yes"
   - Total = sum of the above.
3. **Team Membership:** imported from the registration sheet as (team, person) pairs, looking up each person's total.
4. **Team – Scores:** team score = **ROUND(Σ member totals ÷ number of members)**, which is a mean.
5. **Team – Ranked:** split into **Official teams (≥ 4 members)** and **Unofficial teams (too small)**, each sorted by team score.
6. **Individual – Ranked** and a separate **Top AGFT Scores** leaderboard.

### 3.6 Team rules

- Teams should have more than 4 people. A person can be on more than one team.
- At the halfway point, a captain can ask to remove a member who hasn't participated at all. Members who participate inconsistently stay on the team.

### 3.7 Announcement schedule

| When | Message |
|---|---|
| Registration opens (2–3 weeks before start) | Registration is open; it closes 5–7 days before the start. |
| Registration closes | Captains: confirm your team roster. |
| Day 1 | Reveal the bonus challenge. |
| End of week 1 | Reminder: schedule your meetup; declare your personal goal. |
| End of week 3 | Captains: review rosters and remove zero-score members (or do it automatically?). |
| End of week 4 | Reminder: finish your personal goal and the bonus challenge. |
| End of week 6 | Reminder: submit your final check-in. |

### 3.8 Pain points

- Keeping the name dropdown in sync with registrations by hand, plus the mistakes that come from picking the wrong name.
- A fragile chain of formulas, pivots and `IMPORTRANGE` across two spreadsheets.
- **Being on several teams makes scoring much harder.** Participant opinion on multi-team membership is split.
- Announcements are sent by hand.
- Goals and evidence aren't checked (honor system), which differs from how earlier organizers ran it.
- Participants only see standings when the organizer publishes them.

---

## 4. Roles and permissions

| Role | Can… |
|---|---|
| **Visitor** (not logged in) | Sign up and log in. |
| **User** | See competitions they're allowed to see; create a competition; join a competition. |
| **Participant** | Log entries for themselves; see leaderboards; create or join teams (if the competition allows); post in the discussion. |
| **Captain** | Everything a participant can do, plus approve or reject join requests, remove members (within the rules), rename the team, and hand captaincy to another member. |
| **Admin** | Everything above, plus edit the competition; manage tasks, teams and participants; edit or void entries; review evidence; send announcements; export data; add other admins. |

---

## 5. Functional requirements

**Status key:** ✅ Done · 🟡 Partial · ⬜ Not started
**Priority key:** **P1** = needed to run StrenGames · **P2** = important · **P3** = nice to have

### 5.1 Accounts and profiles

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-ACCT-01 | Users can sign up with email, password and display name. | P1 | ✅ |
| REQ-ACCT-02 | Users can log in and log out. | P1 | ✅ |
| REQ-ACCT-03 | Password reset by email. | P1 | ⬜ |
| REQ-ACCT-04 | Users can edit their display name, and the change shows in all competitions. | P2 | ⬜ |
| REQ-ACCT-05 | Optional social sign-in (e.g. Google). | P3 | ⬜ |
| REQ-ACCT-06 | Users can see a list of competitions they've joined, separate from ones they can browse. | P2 | ⬜ |

### 5.2 Competition setup

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-COMP-01 | An admin can create a competition with a name, description, start date and end date. | P1 | ✅ |
| REQ-COMP-02 | The creator automatically becomes an admin. | P1 | ✅ |
| REQ-COMP-03 | Access type is **Open**, **Registration code** or **Link only**. A code is generated for code-based access. | P1 | 🟡 Setting is stored and a code generated, but neither is enforced (see REQ-REG-02/03). |
| REQ-COMP-04 | A **registration window** (open and close dates) separate from the competition dates. Joining is blocked outside it. | P1 | ⬜ |
| REQ-COMP-05 | **Week start day** is configurable (e.g. Saturday for StrenGames VI, which ran Sat→Fri). Weeks are numbered relative to the competition start ("Week 1…6"), not calendar weeks. | P1 | ⬜ Weeks are currently ISO-style calendar weeks starting Sunday. |
| REQ-COMP-06 | **Competition timezone** used for period boundaries and deadlines. | P1 | ⬜ |
| REQ-COMP-07 | Admins can **edit** a competition after creating it (details, tasks, team settings), with safeguards once it has started (e.g. changing a task's points recalculates scores). | P1 | ⬜ |
| REQ-COMP-08 | Admins can **clone** a past competition as a template for the next season. | P2 | ⬜ |
| REQ-COMP-09 | Admins can add or remove other admins. | P2 | ⬜ |
| REQ-COMP-10 | A rules / "how it works" page per competition (rich text) that replaces the forum thread. | P2 | ⬜ |
| REQ-COMP-11 | Admins can delete or archive a competition. | P3 | ⬜ |
| REQ-COMP-12 | The create wizard validates its input (end after start, task names required, points ≥ 0). | P2 | 🟡 Only checks that name and dates are present. |

### 5.3 Tasks and scoring rules

The app needs a small set of **generic task types** that can express StrenGames and similar competitions.

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-TASK-01 | **Per-period task:** earns *P* points each period (day or week) it is completed. | P1 | ✅ Daily and weekly checkboxes exist. |
| REQ-TASK-02 | **Once-per-competition task:** earns *P* points the first time it is completed. | P1 | ✅ |
| REQ-TASK-03 | **Best-value task:** the participant enters a numeric result; the score is the best value submitted across the competition, optionally capped at a maximum (e.g. AGFT, max 500). The participant can submit many attempts. | P1 | ⬜ |
| REQ-TASK-04 | **Declared-goal task:** the participant must *declare* a goal (text) by a **declaration deadline** (e.g. end of week 1). They then mark it complete, optionally with evidence. If it isn't declared by the deadline, completion scores 0. | P1 | 🟡 An `isUserDefinedGoal` flag is stored but nothing uses it. |
| REQ-TASK-05 | **Hidden / scheduled-reveal task:** the task is hidden from participants until a reveal date (e.g. a bonus challenge revealed on day 1). | P1 | ⬜ |
| REQ-TASK-06 | **Detail field:** a task can require a short text note with each entry (e.g. "Which badge requirement?"). | P1 | ⬜ |
| REQ-TASK-07 | A task can have a **description and rules text** (e.g. "Can't double-count an Agon as a badge requirement"). | P2 | ⬜ |
| REQ-TASK-08 | **Per-period cap / quantity** (generalization): allow logging a count within a period (e.g. 1–7 days, or hours of service) with points per unit and an optional cap. | P3 | ⬜ |
| REQ-TASK-09 | **Cumulative-target task** (generalization): complete *N* units over the competition to earn *P* points (e.g. 12 service hours). For StrenGames this can be modeled as a once task. | P3 | ⬜ |
| REQ-TASK-10 | Task **categories** for grouping and for per-category score breakdowns. | P3 | ⬜ |
| REQ-TASK-11 | Show the competition's maximum possible score, computed from the tasks and the number of periods. | P3 | ⬜ |

### 5.4 Logging and deadlines

This replaces the weekly check-in form. Participants log entries **as often as they like**, and each period has a hard deadline.

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-LOG-01 | A participant can mark a task complete (or undo it) for a specific day or week. | P1 | ✅ |
| REQ-LOG-02 | Participants can browse back and forth across days and weeks to log past periods. | P1 | ✅ |
| REQ-LOG-03 | **Logging deadline:** entries for a period can be created, changed or removed only until *period end + `checkinDueDateOffset` days*, measured in the competition timezone. After that the period is **locked** for participants. | P1 | 🟡 Offset is stored per task but not enforced. |
| REQ-LOG-04 | The UI shows each period's deadline and lock state ("Week 2 locks Wed 6:00 am ET"). | P1 | ⬜ |
| REQ-LOG-05 | Entries can't be logged for future periods, or for dates before the start or after the end of the competition. | P1 | 🟡 Future dates are blocked; navigation stops at the start date. The end date isn't enforced, and the weekly future-week check is wrong across a year boundary. |
| REQ-LOG-06 | Deadlines are enforced **server-side** (Firestore rules or a backend function), not only in the UI. | P1 | ⬜ |
| REQ-LOG-07 | Admins can log, edit or void entries for any participant, including after the lock (with an audit trail). | P2 | ⬜ |
| REQ-LOG-08 | A "This week" summary view: all tasks for the current period on one screen, quick to fill in on a phone. | P2 | 🟡 Tabs for daily, weekly and once exist; there is no combined view. |
| REQ-LOG-09 | Only participants can log entries (non-participants see the tasks read-only). | P1 | ⬜ |

### 5.5 Registration and joining

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-REG-01 | A user can join a competition, creating a participant record with score 0. | P1 | ✅ |
| REQ-REG-02 | **Code access:** joining requires the correct registration code. | P2 | ⬜ |
| REQ-REG-03 | **Link-only access:** the competition is hidden from the dashboard and reachable only by a shareable link. | P2 | ⬜ |
| REQ-REG-04 | Joining respects the registration window (REQ-COMP-04). | P1 | ⬜ |
| REQ-REG-05 | When joining, the participant can optionally choose a team or create one (subject to team settings). | P1 | ⬜ |
| REQ-REG-06 | A participant can leave a competition before it starts. | P2 | ⬜ |
| REQ-REG-07 | A public (to participants) **roster** page showing who's signed up and their teams. | P2 | ⬜ |
| REQ-REG-08 | Each competition has a shareable URL (deep link) instead of the in-memory view only. | P1 | ⬜ No routing exists yet. |

### 5.6 Teams

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-TEAM-01 | **Participation mode:** Individual only, Team, or Mixed. | P1 | 🟡 Setting is stored; there's no team functionality behind it. |
| REQ-TEAM-02 | **Team creation:** by admins only, or by participants. | P1 | 🟡 Setting is stored only. |
| REQ-TEAM-03 | Creating a team makes the creator its **captain**. | P1 | ⬜ |
| REQ-TEAM-04 | **Join requests:** a participant asks to join a team; the captain approves or rejects. An optional setting allows auto-approve. | P1 | ⬜ |
| REQ-TEAM-05 | Team-creation and team-joining windows (StrenGames: until registration closes; rosters confirmed before the start). | P2 | ⬜ |
| REQ-TEAM-06 | **Minimum official team size** (StrenGames: 4). Smaller teams are ranked separately as "unofficial". | P1 | ⬜ |
| REQ-TEAM-07 | **Member removal:** captains (or admins) can remove a member who has **no entries at all**, from a configurable date (StrenGames: the halfway point). Admins can always remove members. | P2 | ⬜ |
| REQ-TEAM-08 | **Allow multiple teams per participant:** an organizer setting. *Planned for removal later.* Build so that turning it off (one team per participant) is the default and the simple path. | P2 | 🟡 Setting is stored only. |
| REQ-TEAM-09 | Captains can hand captaincy to another member; admins can reassign captains. | P3 | ⬜ |
| REQ-TEAM-10 | A team page showing members, each member's score, and the team score. | P1 | ⬜ The Teams panel is a placeholder. |
| REQ-TEAM-11 | An optional team chat link field (GroupMe, Discord, etc.) shown to members. | P3 | ⬜ |

### 5.7 Scoring and leaderboards

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-SCORE-01 | Individual score = the sum of points from all valid entries, applying each task type's rules (§5.3). | P1 | 🟡 Works for daily, weekly and once tasks, using client-side increments. |
| REQ-SCORE-02 | Scores are **derived from entries** (recomputed by a trusted backend when entries change), not incremented by the client. This prevents drift and tampering. | P1 | ⬜ |
| REQ-SCORE-03 | **Team score** = **mean** of member scores (StrenGames) or **sum**, as configured. Rounded to a whole number. | P1 | ⬜ Setting is stored; there's no calculation. |
| REQ-SCORE-04 | **Individual leaderboard**, ranked by score, with ties handled consistently. | P1 | ✅ |
| REQ-SCORE-05 | **Team leaderboard**, split into **Official** and **Unofficial** sections by minimum team size. | P1 | 🟡 A teams tab exists but sorts by a non-existent stored score, with no split. |
| REQ-SCORE-06 | **Per-task leaderboards** (e.g. Top AGFT scores), configurable per task. | P2 | ⬜ |
| REQ-SCORE-07 | A participant can see a **per-task breakdown** of their own score (like the "Individual – Scores" sheet). | P1 | ⬜ |
| REQ-SCORE-08 | Leaderboards update in real time. | P2 | ✅ Firestore listeners. |
| REQ-SCORE-09 | Admins can **freeze / publish final results** after the last deadline passes. | P2 | ⬜ |
| REQ-SCORE-10 | Option to hide leaderboards until a date, or show only the participant's own rank. | P3 | ⬜ |

### 5.8 Verification (optional)

The default is the **honor system**. Organizers can switch on extra checks per task.

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-VER-01 | Honor system by default: entries count as soon as they're logged. | P1 | ✅ |
| REQ-VER-02 | A per-task setting to **require evidence**: a text note, link, and/or photo upload with the entry. | P2 | ⬜ |
| REQ-VER-03 | A per-task setting to **require admin approval**: entries are "pending" (shown but not scored) until approved. | P3 | ⬜ |
| REQ-VER-04 | An admin **review queue** to approve or reject pending entries, with a reason. | P3 | ⬜ |
| REQ-VER-05 | Declared goals (REQ-TASK-04) are visible to other participants, replacing the forum "Personal Goals" thread. | P2 | ⬜ |

### 5.9 Communication

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-COMM-01 | Admins can post **announcements** to a competition (shown in-app; optionally emailed). | P2 | ⬜ |
| REQ-COMM-02 | **Scheduled announcements:** compose ahead of time and send automatically at a date (covers the §3.7 schedule). | P2 | ⬜ |
| REQ-COMM-03 | **Automatic reminders:** e.g. "Week N locks in 24h and you have no entries", "Declare your personal goal by Friday". Participants can opt out. | P2 | ⬜ |
| REQ-COMM-04 | Targeted messages, e.g. "to captains only" (roster confirmation, roster review). | P3 | ⬜ |
| REQ-COMM-05 | A **discussion board** per competition. | P3 | ⬜ The panel is a placeholder. |
| REQ-COMM-06 | Notify the captain of new join requests; notify the requester of the decision. | P2 | ⬜ |

### 5.10 Admin tools

| ID | Requirement | Pri | Status |
|---|---|---|---|
| REQ-ADM-01 | An admin view of all participants, with team(s), score, last activity and number of entries. | P1 | ⬜ |
| REQ-ADM-02 | Highlight participants and teams with **zero activity** (to support the halfway-point roster review). | P2 | ⬜ |
| REQ-ADM-03 | Admins can create, rename, merge and delete teams, and move participants between teams. | P1 | ⬜ |
| REQ-ADM-04 | Admins can remove a participant from a competition. | P2 | ⬜ |
| REQ-ADM-05 | **Export** participants, entries and scores to CSV (for archiving and analysis). | P2 | ⬜ |
| REQ-ADM-06 | An **audit log** of admin changes (entry edits, removals, score overrides). | P3 | ⬜ |
| REQ-ADM-07 | A one-off **import** of a participant roster (CSV) for migrating from the spreadsheet. | P3 | ⬜ |

---

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Mobile-first:** daily logging must be fast on a phone (one screen, big tap targets). |
| NFR-02 | **Data integrity:** Firestore security rules ensure that only participants write their own entries, only admins change competition settings, and scores can't be set directly by clients. |
| NFR-03 | **Scale:** comfortably supports ~250 participants and ~50 teams per competition, and many concurrent competitions. |
| NFR-04 | **Timezones:** all period boundaries and deadlines are computed in the competition timezone and shown in the viewer's local time. |
| NFR-05 | **Privacy:** emails are visible only to admins. Other participants see display names only. |
| NFR-06 | **Accessibility:** WCAG 2.1 AA basics (contrast, keyboard navigation, labels). |
| NFR-07 | **Hosting / CI:** Firebase Hosting with preview deploys on PRs. Lint runs in CI (already set up). |
| NFR-08 | **Testability:** scoring and deadline logic live in pure, unit-tested functions shared by the UI and the backend. |
| NFR-09 | **Cost:** stays within Firebase's free or low tiers for StrenGames-sized usage. |

---

## 7. StrenGames reference configuration (acceptance test)

A competition configured like this must reproduce the spreadsheet's results.

**Competition**
- 6 weeks, starting on a Saturday. Week start = Saturday. Timezone = America/New_York.
- Registration closes about 7 days before the start. Access: link only or code.
- Mode: Mixed (individual plus optional teams). Participants create teams; captains approve joins.
- Team score = **average**. Minimum official team size = **4**. Multiple teams per participant = organizer's choice.
- Logging deadline offset ≈ 4 days after the week ends (e.g. Wednesday 6:00 am ET).

**Tasks**

| Task | Type | Points | Extra settings | Max over 6 weeks |
|---|---|---|---|---|
| Physical activity | Per-period (day) | 10 | | 42 × 10 = **420** |
| Good deed | Per-period (day) | 10 | | 42 × 10 = **420** |
| Agon | Per-period (week) | 80 | | 6 × 80 = **480** |
| Badge requirement | Per-period (week) | 80 | Detail field: "Which requirement?" | 6 × 80 = **480** |
| AGFT | Best value | = value | Cap 500; per-task leaderboard | **500** |
| TSL meet-up | Once | 200 | | **200** |
| Personal goal | Declared goal | 250 | Declare by end of week 1 | **250** |
| Bonus challenge | Once, hidden | 250 | Revealed on day 1 | **250** |
| **Total** | | | | **3000** ✔ matches the playbook's perfect score |

**Acceptance checks**
1. Logging 5 PA days in week 2 adds 50 points. Logging after week 2's deadline is rejected.
2. Entering AGFT results of 310 then 290 leaves 310 counted. Entering 520 counts as 500.
3. Marking the personal goal complete without declaring it by the end of week 1 scores 0.
4. The bonus task isn't visible before day 1.
5. A team of members scoring {2304, 1578, 0, 1035} has a team score of round(4917 / 4) = **1229** and is "official". A 3-member team appears under "unofficial".

---

## 8. Known gaps and bugs in the current code

Found while reviewing the code (`src/App.jsx`, `src/components/*Tasks.jsx`) for this document:

1. **Client-side score increments:** `handleTaskCheck` writes an entry and then separately does `increment(points)` on the participant. A failure between the two writes, a double click, or a malicious client can make the score drift from the entries. → REQ-SCORE-02.
2. **Access settings aren't enforced:** the dashboard queries *all* competitions, and Join never checks `accessCode` or `accessType`. → REQ-REG-02/03.
3. **`checkinDueDateOffset` and `isUserDefinedGoal`** are collected in the wizard but never read. → REQ-LOG-03, REQ-TASK-04.
4. **Weekly periods:** `getWeekInfo` in `WeeklyTasks.jsx` uses UTC, Sunday-start calendar weeks, while `handleTaskCheck` turns the week start into a *local* date string. Users west of UTC may get a different entry date than the one the UI looks up. The "future week" check also compares week numbers without handling the year correctly.
5. **Team leaderboard** sorts `teams` by a `score` field that nothing writes. The Teams and Discussion panels are placeholders.
6. **No routing:** competitions can't be linked to directly (needed for "join by link").
7. **No input validation** on task points or dates beyond the required fields. Points are stored as strings from the form inputs.
8. **Firestore security rules** aren't in the repo, so it isn't clear what's enforced server-side.

---

## 9. Open questions

1. **Multiple teams:** when this setting is removed, should multi-team competitions already in progress keep working? What date should the default change take effect?
2. **Daily vs. weekly logging granularity:** StrenGames' form asked for "days this week" (0–7). Is it acceptable that participants now tick individual days? (Recommended: yes. It's more accurate and the deadline still applies.)
3. **Deadline precision:** is a whole-day offset enough, or is a time of day needed (e.g. "6:00 am ET")? (Recommended: offset in days plus a time of day, in the competition timezone.)
4. **Removing inactive members:** fully automatic at the halfway point, or a captain/admin action helped by a "zero activity" report?
5. **Notifications:** is email required for StrenGames, or are in-app announcements enough for v1?
6. **Accounts:** should a participant's identity be tied to their TSL membership in any way, or are standalone accounts fine?
7. **Competition visibility:** who can create competitions? Anyone, or only approved organizers?
8. **Historical data:** should past StrenGames results (from the spreadsheets) be imported?

---

## 10. Suggested roadmap

**Phase 1: StrenGames MVP (all P1 items)**
- Routing / deep links. Competition timezone and week start. Registration window.
- Logging deadlines enforced server-side. Best-value, declared-goal and hidden task types. Detail field.
- Teams: create, join requests and captain approval, team page, minimum official size.
- Trusted score computation; team averages; official/unofficial leaderboards; per-participant breakdown.
- Admin participant and team management. Firestore security rules. Password reset. Editing a competition.

**Phase 2: Running it smoothly (P2)**
- Announcements (in-app and email), scheduled announcements, automatic reminders.
- Per-task leaderboards (Top AGFT), roster page, zero-activity report, member removal.
- Optional evidence, CSV export, clone competition, code and link-only access.

**Phase 3: Generic platform (P3)**
- Approval workflow, discussion board, quantity and cumulative task types, categories.
- Audit log, imports, social login, privacy options for leaderboards.
- Retire the multi-team option (REQ-TEAM-08) once the community has decided.
