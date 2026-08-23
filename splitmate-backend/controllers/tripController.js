const User = require('../models/User');  
const Trip = require('../models/Trip');
const FriendRequest = require('../models/FriendRequest');
const SavedItinerary = require('../models/SavedItinerary');

// Helper function to incrementally apply or remove an expense from the balanceMatrix in O(Participants)
function applyExpenseDelta(trip, expense, sign = 1) {
  const members = trip.members;
  const n = members.length;

  if (!trip.balanceMatrix || trip.balanceMatrix.length !== n) {
    trip.balanceMatrix = Array(n).fill().map(() => Array(n).fill(0));
  }

  // 1. Calculate paid amount for each member from multi-payer paidBy array
  const paid = Array(n).fill(0);
  (expense.paidBy || []).forEach(payer => {
    const pId = payer.user?._id || payer.user;
    const idx = members.findIndex(m => (m._id || m).toString() === pId.toString());
    if (idx !== -1) {
      paid[idx] += Number(payer.amount) || 0;
    }
  });

  // 2. Calculate owed amount for each member (custom split vs equal split)
  const owes = Array(n).fill(0);
  if (expense.splitType === 'exact' && Array.isArray(expense.splits) && expense.splits.length > 0) {
    expense.splits.forEach(s => {
      const sId = s.user?._id || s.user;
      const idx = members.findIndex(m => (m._id || m).toString() === sId.toString());
      if (idx !== -1) {
        owes[idx] += Number(s.amount) || 0;
      }
    });
  } else {
    const splitList = expense.splitBetween || [];
    if (splitList.length > 0) {
      const perShare = Number(expense.amount) / splitList.length;
      splitList.forEach(splitUser => {
        const sId = splitUser?._id || splitUser;
        const idx = members.findIndex(m => (m._id || m).toString() === sId.toString());
        if (idx !== -1) {
          owes[idx] += perShare;
        }
      });
    }
  }

  // 3. Net balance for this expense (positive = creditor who paid more, negative = debtor who owes)
  const netBalance = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    netBalance[i] = paid[i] - owes[i];
  }

  // 4. Determine creditors and debtors
  const creditors = [];
  const debtors = [];
  for (let i = 0; i < n; i++) {
    if (netBalance[i] > 0.0001) creditors.push({ idx: i, amount: netBalance[i] });
    if (netBalance[i] < -0.0001) debtors.push({ idx: i, amount: -netBalance[i] });
  }

  // 5. Debtors pay creditors proportionally in O(P)
  // matrix[debtor][creditor] += amount (debtor owes creditor)
  // matrix[creditor][debtor] -= amount (creditor gets from debtor)
  const totalCredit = creditors.reduce((sum, c) => sum + c.amount, 0);
  if (totalCredit > 0) {
    debtors.forEach(debtor => {
      creditors.forEach(creditor => {
        const proportion = creditor.amount / totalCredit;
        const delta = debtor.amount * proportion * sign;
        trip.balanceMatrix[debtor.idx][creditor.idx] += delta;
        trip.balanceMatrix[creditor.idx][debtor.idx] -= delta;
      });
    });
  }

  return trip.balanceMatrix;
}

// 1. Create Trip (Strict existence validation on members, sorted indices)
exports.createTrip = async (req, res) => {
  try {
    let { title, memberUsernames, attachedPlan } = req.body;

    title = String(title || '').trim();
    if (!title || title.length === 0) {
      return res.status(400).json({ message: "Trip title is required" });
    }

    let members = [];
    if (Array.isArray(memberUsernames) && memberUsernames.length > 0) {
      const cleanInputs = memberUsernames.map(s => String(s).trim()).filter(Boolean);
      
      members = await User.find({
        $or: [
          { username: { $in: cleanInputs.map(u => new RegExp(`^${u}$`, 'i')) } },
          { email: { $in: cleanInputs.map(e => new RegExp(`^${e}$`, 'i')) } }
        ]
      });

      // Strict Validation: Ensure every requested member exists in database
      const foundUsernames = members.map(m => (m.username || '').toLowerCase());
      const foundEmails = members.map(m => (m.email || '').toLowerCase());
      const missing = cleanInputs.filter(input => {
        const lower = input.toLowerCase();
        return !foundUsernames.includes(lower) && !foundEmails.includes(lower);
      });

      if (missing.length > 0) {
        return res.status(404).json({
          message: `User(s) not found: "${missing.join(', ')}". Please ensure they have signed up for TripMate first.`
        });
      }
    }

    let memberIds = members.map(m => m._id.toString());

    // Include trip creator
    if (!memberIds.includes(req.user.id)) {
      memberIds.push(req.user.id);
      const creator = await User.findById(req.user.id);
      if (creator) members.push(creator);
    }

    // Sort consistently by username or name to ensure deterministic indexing
    members.sort((a, b) => (a.username || a.name || '').localeCompare(b.username || b.name || ''));
    memberIds = members.map(m => m._id);

    const n = memberIds.length;
    const balanceMatrix = Array(n).fill().map(() => Array(n).fill(0));

    const tripPayload = {
      title,
      members: memberIds,
      createdBy: req.user.id,
      balanceMatrix
    };

    if (attachedPlan && typeof attachedPlan === 'object' && attachedPlan.planId && attachedPlan.planId !== 'detach' && attachedPlan.planId !== '') {
      tripPayload.attachedPlan = {
        planId: attachedPlan.planId || '',
        title: attachedPlan.title || '',
        destination: attachedPlan.destination || '',
        version: attachedPlan.version || 1,
        itinerary: attachedPlan.itinerary || '',
        duration: attachedPlan.duration || '',
        groupSize: attachedPlan.groupSize || '',
        budget: attachedPlan.budget || '',
        attachedAt: new Date()
      };
    }

    const trip = new Trip(tripPayload);
    await trip.save();

    res.status(201).json({ message: "Trip created successfully!", tripId: trip._id, title: trip.title });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Get all trips of the logged-in user
exports.getUserTrips = async (req, res) => {
  try {
    const userId = req.user.id;

    const trips = await Trip.find({ members: userId })
      .select('title members createdAt updatedAt attachedPlan createdBy')
      .populate('members', 'username name email')
      .populate('createdBy', 'username name email')
      .sort({ createdAt: -1 });

    res.status(200).json(trips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Get Trip Details (Deep populates members, createdBy, paidBy, splitBetween and splits)
exports.getTripDetails = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('members', 'username name email')
      .populate('createdBy', 'username name email')
      .populate('expenses.paidBy.user', 'username name email')
      .populate('expenses.splitBetween', 'username name email')
      .populate('expenses.splits.user', 'username name email');
      
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const isMember = trip.members.some(
      member => member._id.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this trip" });
    }

    res.status(200).json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Attach / Detach Itinerary Plan
exports.attachPlanToTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { planId, title, destination, version, itinerary, duration, groupSize, budget } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!trip.members.some(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: "You are not authorized to modify this trip" });
    }

    if (!planId || planId === 'detach' || planId === 'none' || planId === 'remove' || planId === '') {
      trip.attachedPlan = undefined;
      await trip.save();
      return res.status(200).json({ message: "Itinerary plan removed from trip.", attachedPlan: null });
    }

    trip.attachedPlan = {
      planId: planId || '',
      title: title || '',
      destination: destination || '',
      version: Number(version) || 1,
      itinerary: itinerary || '',
      duration: duration || '',
      groupSize: groupSize || '',
      budget: budget || '',
      attachedAt: new Date()
    };

    await trip.save();
    res.status(200).json({ message: "Itinerary plan attached to trip successfully!", attachedPlan: trip.attachedPlan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Get Expenses for a Trip (Fully populated)
exports.getExpenses = async (req, res) => {
  const { tripId } = req.params;
  try {
    const trip = await Trip.findById(tripId)
      .populate('expenses.paidBy.user', 'username name email')
      .populate('expenses.splitBetween', 'username name email')
      .populate('expenses.splits.user', 'username name email');

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const isMember = trip.members.some(
      member => member.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this trip" });
    }

    trip.expenses.sort((a, b) => b._id.getTimestamp() - a._id.getTimestamp());
    res.status(200).json(trip.expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Add Expense to Trip
exports.addExpense = async (req, res) => {
  try {
    const { tripId } = req.params;
    let { description, amount, paidBy, splitBetween, splits, splitType, category } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const tripMembers = trip.members.map(m => m.toString());
    if (!tripMembers.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this trip" });
    }

    // Consolidate duplicate payers by User ID
    if (!Array.isArray(paidBy) || paidBy.length === 0) {
      return res.status(400).json({ message: "At least one payer is required" });
    }

    const payerMap = new Map();
    for (const p of paidBy) {
      const uId = String(p.user?._id || p.user || '').trim();
      const amt = Number(p.amount) || 0;
      if (uId && amt > 0) {
        payerMap.set(uId, (payerMap.get(uId) || 0) + amt);
      }
    }

    const cleanPaidBy = Array.from(payerMap.entries()).map(([user, amount]) => ({ user, amount }));

    if (cleanPaidBy.length === 0) {
      return res.status(400).json({ message: "At least one payer with a positive amount is required" });
    }

    for (let p of cleanPaidBy) {
      if (!tripMembers.includes(p.user.toString())) {
        return res.status(400).json({ message: `Payer ${p.user} is not a member of the trip` });
      }
    }

    const totalPaid = cleanPaidBy.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - amount) > 0.05) {
      return res.status(400).json({ 
        message: `Total paid (${totalPaid}) must equal the expense amount (${amount})` 
      });
    }

    // Split validation
    let cleanSplitBetween = [];
    let cleanSplits = [];
    splitType = splitType === 'exact' ? 'exact' : 'equal';

    if (splitType === 'exact') {
      if (!Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({ message: "Please specify exact split amounts" });
      }
      
      const splitMap = new Map();
      for (const s of splits) {
        const uId = String(s.user?._id || s.user || '').trim();
        const amt = Number(s.amount) || 0;
        if (uId && amt > 0) {
          splitMap.set(uId, (splitMap.get(uId) || 0) + amt);
        }
      }

      cleanSplits = Array.from(splitMap.entries()).map(([user, amount]) => ({ user, amount }));

      const totalSplit = cleanSplits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(totalSplit - amount) > 0.05) {
        return res.status(400).json({
          message: `Total split sum (₹${totalSplit}) must equal the expense amount (₹${amount})`
        });
      }
      cleanSplitBetween = cleanSplits.map(s => s.user);
    } else {
      cleanSplitBetween = Array.from(new Set(
        (Array.isArray(splitBetween) ? splitBetween : []).map(u => String(u?._id || u || '').trim()).filter(Boolean)
      ));
      if (cleanSplitBetween.length === 0) {
        return res.status(400).json({ message: "Expense must be split among at least one member" });
      }
    }

    const newExpense = {
      description: description.trim(),
      amount,
      paidBy: cleanPaidBy,
      splitBetween: cleanSplitBetween,
      splits: cleanSplits,
      splitType,
      category: category || 'Food'
    };

    trip.expenses.push(newExpense);
    applyExpenseDelta(trip, newExpense, 1);
    await trip.save();

    return res.status(201).json({ 
      message: "Expense added & balance updated!",
      balanceMatrix: trip.balanceMatrix 
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 7. Edit Expense
exports.editExpense = async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    let { description, amount, paidBy, splitBetween, splits, splitType, category } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!trip.members.some(m => m.equals(req.user.id))) {
      return res.status(403).json({ message: "You're not a member of this trip" });
    }

    const expenseIndex = trip.expenses.findIndex(e => e._id.equals(expenseId));
    if (expenseIndex === -1) return res.status(404).json({ message: "Expense not found" });

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const tripMembers = trip.members.map(m => m.toString());

    // Consolidate duplicate payers by User ID
    const payerMap = new Map();
    for (const p of (paidBy || [])) {
      const uId = String(p.user?._id || p.user || '').trim();
      const amt = Number(p.amount) || 0;
      if (uId && amt > 0) {
        payerMap.set(uId, (payerMap.get(uId) || 0) + amt);
      }
    }

    const cleanPaidBy = Array.from(payerMap.entries()).map(([user, amount]) => ({ user, amount }));

    if (cleanPaidBy.length === 0) {
      return res.status(400).json({ message: "At least one payer with a positive amount is required" });
    }

    for (let p of cleanPaidBy) {
      if (!tripMembers.includes(p.user.toString())) {
        return res.status(400).json({ message: `Payer ${p.user} is not part of the trip` });
      }
    }

    const totalPaid = cleanPaidBy.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - amount) > 0.05) {
      return res.status(400).json({ message: "Total paid must equal expense amount" });
    }

    let cleanSplitBetween = [];
    let cleanSplits = [];
    splitType = splitType === 'exact' ? 'exact' : 'equal';

    if (splitType === 'exact') {
      const splitMap = new Map();
      for (const s of (splits || [])) {
        const uId = String(s.user?._id || s.user || '').trim();
        const amt = Number(s.amount) || 0;
        if (uId && amt > 0) {
          splitMap.set(uId, (splitMap.get(uId) || 0) + amt);
        }
      }

      cleanSplits = Array.from(splitMap.entries()).map(([user, amount]) => ({ user, amount }));

      const totalSplit = cleanSplits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(totalSplit - amount) > 0.05) {
        return res.status(400).json({
          message: `Total split sum (₹${totalSplit}) must equal the expense amount (₹${amount})`
        });
      }
      cleanSplitBetween = cleanSplits.map(s => s.user);
    } else {
      cleanSplitBetween = Array.from(new Set(
        (Array.isArray(splitBetween) ? splitBetween : []).map(u => String(u?._id || u || '').trim()).filter(Boolean)
      ));
      if (cleanSplitBetween.length === 0) {
        return res.status(400).json({ message: "Expense must be split among at least one member" });
      }
    }

    const oldExpense = trip.expenses[expenseIndex];

    applyExpenseDelta(trip, oldExpense, -1);
    Object.assign(trip.expenses[expenseIndex], {
      description: description.trim(),
      amount,
      paidBy: cleanPaidBy,
      splitBetween: cleanSplitBetween,
      splits: cleanSplits,
      splitType,
      category: category || 'Food'
    });
    applyExpenseDelta(trip, trip.expenses[expenseIndex], 1);

    await trip.save();

    res.status(200).json({ message: "Expense updated successfully", balanceMatrix: trip.balanceMatrix });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 8. Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!trip.members.some(m => m.equals(req.user.id))) {
      return res.status(403).json({ message: "You're not a member of this trip" });
    }

    const index = trip.expenses.findIndex(e => e._id.equals(expenseId));
    if (index === -1) return res.status(404).json({ message: "Expense not found" });

    const expenseToDelete = trip.expenses[index];
    applyExpenseDelta(trip, expenseToDelete, -1);

    trip.expenses.splice(index, 1);
    await trip.save();

    res.status(200).json({ message: "Expense deleted successfully", balanceMatrix: trip.balanceMatrix });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 9. Get Balance Matrix
exports.getBalanceMatrix = async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const isMember = trip.members.some(
      member => member.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this trip" });
    }

    return res.status(200).json({ balanceMatrix: trip.balanceMatrix });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 10. Get Personal Balances in Trip (Matches SplitMate legacy exact structure)
exports.getMyBalancesInTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await Trip.findById(tripId).populate('members', 'username name email');
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const index = trip.members.findIndex(m => m._id.equals(userId));
    if (index === -1) return res.status(403).json({ message: "You are not part of this trip" });

    let balances;
    if (!trip.balanceMatrix || !Array.isArray(trip.balanceMatrix) || trip.balanceMatrix.length !== trip.members.length) {
      balances = trip.members.map((member, i) => {
        if (i === index) return null;
        return {
          userId: member._id,
          username: member.username,
          name: member.name,
          balance: 0
        };
      }).filter(b => b !== null);
    } else {
      balances = trip.members.map((member, i) => {
        if (i === index) return null;
        return {
          userId: member._id,
          username: member.username,
          name: member.name,
          balance: trip.balanceMatrix[index][i] || 0
        };
      }).filter(b => b !== null);
    }

    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 11. Get Single Expense by ID
exports.getExpenseById = async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('expenses.paidBy.user', 'username name email')
      .populate('expenses.splitBetween', 'username name email')
      .populate('expenses.splits.user', 'username name email');

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const expense = trip.expenses.id(expenseId);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const isTripMember = trip.members.some(m => m.equals(req.user.id));
    if (!isTripMember) {
      return res.status(403).json({ message: "Not authorized to view this expense" });
    }

    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 12. Add Members to Trip
exports.addMemberToTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { username, email, identifier, members: incomingMembersList } = req.body;

    let targets = [];
    if (Array.isArray(incomingMembersList) && incomingMembersList.length > 0) {
      targets = incomingMembersList.map(s => String(s).trim()).filter(Boolean);
    } else {
      const single = (identifier || username || email || '').trim();
      if (single) targets = [single];
    }

    if (targets.length === 0) {
      return res.status(400).json({ message: "Please provide at least one username or email to add." });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!trip.members.some(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this trip" });
    }

    // Lookup users
    const matchedUsers = await User.find({
      $or: [
        { username: { $in: targets.map(u => new RegExp(`^${u}$`, 'i')) } },
        { email: { $in: targets.map(e => new RegExp(`^${e}$`, 'i')) } }
      ]
    });

    const foundUsernames = matchedUsers.map(m => (m.username || '').toLowerCase());
    const foundEmails = matchedUsers.map(m => (m.email || '').toLowerCase());
    const missing = targets.filter(input => {
      const lower = input.toLowerCase();
      return !foundUsernames.includes(lower) && !foundEmails.includes(lower);
    });

    if (missing.length > 0) {
      return res.status(404).json({
        message: `User(s) not found: "${missing.join(', ')}". Please ensure they have signed up for TripMate.`
      });
    }

    // Filter out users already in trip
    const existingMemberIds = trip.members.map(m => m.toString());
    const newUsersToAdd = matchedUsers.filter(u => !existingMemberIds.includes(u._id.toString()));

    if (newUsersToAdd.length === 0) {
      return res.status(400).json({ message: "All selected users are already members of this trip." });
    }

    newUsersToAdd.forEach(u => trip.members.push(u._id));

    // Expand balanceMatrix to new dimension
    const n = trip.members.length;
    const newMatrix = Array(n).fill().map(() => Array(n).fill(0));
    if (trip.balanceMatrix && Array.isArray(trip.balanceMatrix)) {
      for (let i = 0; i < trip.balanceMatrix.length; i++) {
        for (let j = 0; j < trip.balanceMatrix[i].length; j++) {
          newMatrix[i][j] = trip.balanceMatrix[i][j];
        }
      }
    }
    trip.balanceMatrix = newMatrix;

    await trip.save();
    const updatedTrip = await Trip.findById(tripId).populate('members', 'username name email');

    const addedNames = newUsersToAdd.map(u => u.name || u.username).join(', ');
    res.status(200).json({
      message: `Successfully added ${addedNames} to the trip!`,
      members: updatedTrip.members,
      balanceMatrix: updatedTrip.balanceMatrix
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 13. Get Category Expenses for a Trip
exports.getTripCategoryExpenses = async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId);

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const categories = {};
    trip.expenses.forEach(expense => {
      categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
    });

    return res.status(200).json({
      tripTitle: trip.title,
      categories
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 14. Get User Category Expenses in Trip (and total user expense)
exports.getUserCategoryExpensesInTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const categories = {};
    let totalUserExpense = 0;

    trip.expenses.forEach(expense => {
      if (expense.splitType === 'exact' && Array.isArray(expense.splits)) {
        const mySplit = expense.splits.find(s => (s.user?._id || s.user).toString() === userId.toString());
        if (mySplit) {
          categories[expense.category] = (categories[expense.category] || 0) + mySplit.amount;
          totalUserExpense += mySplit.amount;
        }
      } else if (expense.splitBetween.map(u => (u?._id || u).toString()).includes(userId.toString())) {
        const splitAmount = expense.amount / expense.splitBetween.length;
        categories[expense.category] = (categories[expense.category] || 0) + splitAmount;
        totalUserExpense += splitAmount;
      }
    });

    return res.status(200).json({ totalUserExpense, categories });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 15. Get Trip Members Expense Summary
exports.getTripMembersExpenseSummary = async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId)
      .populate('members', 'username name email');

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const summary = trip.members.map(member => {
      let total = 0;
      trip.expenses.forEach(expense => {
        if (expense.splitType === 'exact' && Array.isArray(expense.splits)) {
          const mSplit = expense.splits.find(s => (s.user?._id || s.user).toString() === member._id.toString());
          if (mSplit) total += mSplit.amount;
        } else if (expense.splitBetween.map(u => (u?._id || u).toString()).includes(member._id.toString())) {
          total += expense.amount / expense.splitBetween.length;
        }
      });
      return {
        memberId: member._id,
        memberName: member.name || member.username,
        totalExpenseByThatMember: total
      };
    });

    return res.status(200).json({
      tripTitle: trip.title,
      summary
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 16. Get Trip Total Expense
exports.getTripTotalExpense = async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const totalExpense = (trip.expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
    return res.status(200).json({ tripTitle: trip.title, totalExpense });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// 17. Create Trip from AI (Legacy support)
exports.createTripFromAI = async (req, res) => {
  try {
    let { title, destination, budget, flightDetails, hotelDetails, itineraryDetails, memberUsernames } = req.body;
    const finalTitle = (title && title.trim()) ? title.trim() : (destination ? `Trip to ${destination}` : 'AI Planned Trip');
    
    let members = [];
    if (Array.isArray(memberUsernames) && memberUsernames.length > 0) {
      const cleanInputs = memberUsernames.map(s => String(s).trim()).filter(Boolean);
      members = await User.find({
        $or: [
          { username: { $in: cleanInputs.map(u => new RegExp(`^${u}$`, 'i')) } },
          { email: { $in: cleanInputs.map(e => new RegExp(`^${e}$`, 'i')) } }
        ]
      });
    }

    let memberIds = members.map(m => m._id.toString());
    if (!memberIds.includes(req.user.id)) {
      memberIds.push(req.user.id);
      const creator = await User.findById(req.user.id);
      if (creator) members.push(creator);
    }

    members.sort((a, b) => (a.username || a.name || '').localeCompare(b.username || b.name || ''));
    memberIds = members.map(m => m._id);

    const n = memberIds.length;
    const balanceMatrix = Array(n).fill().map(() => Array(n).fill(0));

    const trip = new Trip({
      title: finalTitle,
      members: memberIds,
      createdBy: req.user.id,
      balanceMatrix,
      aiPlan: {
        destination,
        budget,
        flightDetails,
        hotelDetails,
        itineraryDetails
      }
    });

    await trip.save();

    res.status(201).json({ 
      message: "AI Trip saved successfully!", 
      tripId: trip._id, 
      title: trip.title,
      memberCount: memberIds.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 18. Saved Itineraries Handlers
exports.saveItinerary = async (req, res) => {
  try {
    const { 
      title, 
      destination, 
      duration, 
      groupSize, 
      budget, 
      version, 
      status, 
      revisionFeedback, 
      itinerary, 
      selectedAgents 
    } = req.body;

    const finalReport = itinerary || '';
    const dest = destination || 'Vacation';
    const planTitle = title || (dest ? `Trip to ${dest}` : 'AI Planned Itinerary');

    const savedPlan = new SavedItinerary({
      user: req.user.id,
      title: planTitle,
      destination: dest,
      duration: duration || '',
      groupSize: groupSize || '',
      budget: String(budget || ''),
      version: version || 1,
      status: status || 'finalized',
      revisionFeedback: revisionFeedback || '',
      itinerary: finalReport,
      selectedAgents: selectedAgents || []
    });

    const saved = await savedPlan.save();
    res.status(201).json({ message: "Itinerary saved to your history!", planId: saved._id, plan: saved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMySavedItineraries = async (req, res) => {
  try {
    const plans = await SavedItinerary.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSavedItinerary = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await SavedItinerary.findOneAndDelete({ _id: planId, user: req.user.id });
    if (!plan) return res.status(404).json({ message: "Saved itinerary not found" });
    res.status(200).json({ message: "Itinerary removed from history" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

