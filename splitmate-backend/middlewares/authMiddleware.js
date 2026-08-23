// server/middlewares/authMiddleware.js
const { ClerkExpressRequireAuth, clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');

const protect = [
  ClerkExpressRequireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;
      let user = await User.findOne({ clerkId });
      
      // Just-In-Time User Sync
      if (!user) {
         let email = `${clerkId}@example.com`;
         let username = 'User';
         let name = 'User';
         try {
             if (process.env.CLERK_SECRET_KEY) {
                 const clerkUser = await clerkClient.users.getUser(clerkId);
                 email = clerkUser.emailAddresses[0]?.emailAddress || email;
                 username = clerkUser.username || clerkUser.firstName || username;
                 name = (clerkUser.firstName || '') + ' ' + (clerkUser.lastName || '');
             }
         } catch (e) {
             console.log("Could not fetch user details from Clerk.", e.message);
         }
         user = await User.create({
            clerkId: clerkId,
            email: email,
            username: username,
            name: name
         });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth sync error:', error);
      res.status(401).json({ message: 'Not authorized or failed to sync user' });
    }
  }
];

module.exports = protect;
