// controllers/friendController.js
const User = require('../models/User'); 
const FriendRequest = require('../models/FriendRequest');

// Send Friend Request (Supports Username or Email lookup)
exports.sendRequest = async (req, res) => {
  const { username, email, identifier } = req.body;
  const target = (identifier || username || email || '').trim();
  
  if (!target) {
    return res.status(400).json({ message: 'Username or email is required' });
  }

  try {
    // 1. Find receiver by username OR email (case-insensitive)
    const receiver = await User.findOne({
      $or: [
        { username: new RegExp(`^${target}$`, 'i') },
        { email: new RegExp(`^${target}$`, 'i') }
      ]
    });

    if (!receiver) {
      return res.status(404).json({ message: 'User not found! Ensure they have signed up for TripMate.' });
    }

    if (receiver._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself!' });
    }

    // 2. Check if already friends (status: accepted)
    const alreadyFriends = await FriendRequest.findOne({ 
      $or: [
        { sender: req.user.id, receiver: receiver._id, status: 'accepted' },
        { sender: receiver._id, receiver: req.user.id, status: 'accepted' }
      ]
    });

    if (alreadyFriends) {
      return res.status(400).json({ message: `You are already friends with ${receiver.username || receiver.name || 'this user'}!` });
    }

    // 3. Check if receiver already sent you a request (status: pending)
    const reverseRequest = await FriendRequest.findOne({ 
      sender: receiver._id, 
      receiver: req.user.id,
      status: 'pending'
    });

    if (reverseRequest) {
      reverseRequest.status = 'accepted';
      await reverseRequest.save();
      return res.status(200).json({ message: `Friend request accepted! You and ${receiver.username || receiver.name} are now friends!` });
    }

    // 4. Check if you already sent a pending request
    const existingRequest = await FriendRequest.findOne({ 
      sender: req.user.id, 
      receiver: receiver._id, 
      status: 'pending' 
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request is already pending!' });
    }

    // 5. Create new friend request
    await FriendRequest.create({ 
      sender: req.user.id, 
      receiver: receiver._id, 
      status: 'pending' 
    });

    return res.status(201).json({ message: `Friend request sent to ${receiver.username || receiver.name} successfully!` });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get incoming friend requests
exports.getIncomingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ receiver: req.user.id, status: 'pending' })
      .populate('sender', 'username name email');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get outgoing friend requests
exports.getOutgoingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ sender: req.user.id, status: 'pending' })
      .populate('receiver', 'username name email');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Accept or Decline friend request
exports.respondRequest = async (req, res) => {
  const { requestId, action } = req.body;
  try {
    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond' });
    }

    if (!['accepted', 'declined'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'accepted' or 'declined'" });
    }

    request.status = action;
    await request.save();

    return res.status(200).json({ message: `Friend request ${action} successfully!` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
