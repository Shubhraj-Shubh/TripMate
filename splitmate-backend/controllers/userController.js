// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const FriendRequest = require('../models/FriendRequest');
const Trip = require('../models/Trip');

// Get friends with their net balances across trips
exports.getFriendsBalances = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all accepted friendships
    const acceptedRequests = await FriendRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted',
    });

    const friendIds = acceptedRequests.map(fr => {
      return fr.sender.equals(userId) ? fr.receiver.toString() : fr.sender.toString();
    });

    const trips = await Trip.find({ members: userId });

    const balanceMap = {};
    trips.forEach(trip => {
      const myIndex = trip.members.findIndex(m => m.equals(userId));
      if (myIndex === -1 || !trip.balanceMatrix) return;

      trip.members.forEach((memberId, memberIdx) => {
        const memberIdStr = memberId.toString();
        if (memberIdx !== myIndex && friendIds.includes(memberIdStr)) {
          balanceMap[memberIdStr] = (balanceMap[memberIdStr] || 0) + (trip.balanceMatrix[myIndex]?.[memberIdx] || 0);
        }
      });
    });

    const friends = await User.find({ _id: { $in: friendIds } }, 'name username email');
    const result = friends.map(friend => ({
      userId: friend._id,
      _id: friend._id,
      name: friend.name,
      username: friend.username,
      email: friend.email,
      balance: balanceMap[friend._id.toString()] || 0,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  const { username, password, name } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashed, name });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, name: user.name } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Total Trips Count
exports.getTotalTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ members: req.user.id });
    res.status(200).json({ totalTrips: trips.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Total Friends Count
exports.getTotalFriends = async (req, res) => {
  try {
    const friends = await FriendRequest.find({
      $or: [
        { sender: req.user.id, status: 'accepted' },
        { receiver: req.user.id, status: 'accepted' }
      ]
    });
    res.status(200).json({ totalFriends: friends.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Total Expense (User's share)
exports.getTotalExpense = async (req, res) => {
  try {
    const trips = await Trip.find({ members: req.user.id });

    let totalExpense = 0;
    for (let trip of trips) {
      for (let expense of trip.expenses) {
        if (expense.splitBetween.map(u => u.toString()).includes(req.user.id)) {
          totalExpense += expense.amount / expense.splitBetween.length;
        }
      }
    }

    res.status(200).json({ totalExpense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Category-wise summary (User's share)
exports.getCategorySummary = async (req, res) => {
  try {
    const trips = await Trip.find({ members: req.user.id });
    const categorySummary = {};

    for (let trip of trips) {
      for (let expense of trip.expenses) {
        if (expense.splitBetween.map(u => u.toString()).includes(req.user.id)) {
          const userShare = expense.amount / expense.splitBetween.length;
          const cat = expense.category ? (expense.category.charAt(0).toUpperCase() + expense.category.slice(1)) : 'Other';
          categorySummary[cat] = (categorySummary[cat] || 0) + userShare;
        }
      }
    }

    const categories = Object.keys(categorySummary).map(cat => ({
      category: cat,
      amount: Math.round(categorySummary[cat] * 100) / 100
    }));

    res.status(200).json({ categorySummary, categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Recent trips expense summary
exports.getRecentTripsSummary = async (req, res) => {
  try {
    const trips = await Trip.find({ members: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (!trips || trips.length === 0) {
      return res.status(200).json({ summary: [] });
    }

    const summary = trips.map(trip => {
      let total = 0;
      trip.expenses.forEach(expense => {
        if (expense.splitBetween.map(u => u.toString()).includes(req.user.id)) {
          total += expense.amount / expense.splitBetween.length;
        }
      });
      return {
        tripTitle: trip.title,
        tripId: trip._id,
        totalUserExpense: total
      };
    });

    res.status(200).json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
