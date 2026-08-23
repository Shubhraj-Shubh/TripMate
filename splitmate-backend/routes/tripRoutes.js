// routes/tripRoutes.js
const express = require('express');
const protect = require('../middlewares/authMiddleware');
const { 
  createTrip,
  createTripFromAI,
  addMemberToTrip,
  getUserTrips,
  getTripCategoryExpenses,
  getTripTotalExpense,
  getUserCategoryExpensesInTrip,
  getTripDetails,
  getTripMembersExpenseSummary,
  addExpense,
  getExpenses,
  getBalanceMatrix,
  getMyBalancesInTrip,
  editExpense,
  getExpenseById,
  deleteExpense,
  saveItinerary,
  getMySavedItineraries,
  deleteSavedItinerary,
  attachPlanToTrip
} = require('../controllers/tripController');

const router = express.Router();

// Itinerary Persistence (Saved Plans History)
router.post('/itineraries', protect, saveItinerary);
router.get('/itineraries/my', protect, getMySavedItineraries);
router.delete('/itineraries/:planId', protect, deleteSavedItinerary);

// Trips & Expenses
router.post('/create', protect, createTrip);
router.post('/ai', protect, createTripFromAI);
router.get('/my-trips', protect, getUserTrips);
router.get('/:tripId', protect, getTripDetails);
router.put('/:tripId/attach-plan', protect, attachPlanToTrip);
router.post('/:tripId/members', protect, addMemberToTrip);
router.get('/:tripId/totalExpense', protect, getTripTotalExpense);
router.get('/:tripId/category-expenses', protect, getTripCategoryExpenses);
router.get('/:tripId/membersExpenseSummary', protect, getTripMembersExpenseSummary);
router.post('/:tripId/expenses', protect, addExpense);
router.get('/:tripId/expenses', protect, getExpenses); 
router.get('/:tripId/balanceMatrix', protect, getBalanceMatrix);
router.get('/:tripId/my-balances', protect, getMyBalancesInTrip);
router.put('/:tripId/expenses/:expenseId', protect, editExpense);
router.get('/:tripId/expenses/:expenseId', protect, getExpenseById);
router.delete('/:tripId/expenses/:expenseId', protect, deleteExpense);
router.get('/:tripId/user/category-expenses', protect, getUserCategoryExpensesInTrip);

module.exports = router;
