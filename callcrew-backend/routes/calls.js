const express = require('express');
const router = express.Router();

const Business = require('../models/Business');
const Call = require('../models/Call');
const Lead = require('../models/Lead');

/**
 * GET /api/calls
 * Get calls for a business
 */
router.get('/', async (req, res) => {
  try {
    const {
      businessId,
      status,
      startDate,
      endDate,
      limit = 50,
      skip = 0
    } = req.query;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    const calls = await Call.getBusinessCalls(businessId, {
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const total = await Call.countDocuments({ business: businessId });

    res.json({
      success: true,
      calls: calls.map(call => ({
        id: call._id,
        twilioCallSid: call.twilioCallSid,
        fromNumber: call.fromNumber,
        status: call.status,
        duration: call.duration,
        formattedDuration: call.formattedDuration,
        callerIntent: call.callerIntent,
        sentiment: call.sentiment,
        leadCaptured: call.leadCaptured,
        conversationSummary: call.conversationSummary,
        metadata: call.metadata,
        createdAt: call.createdAt
      })),
      total,
      page: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calls' });
  }
});

/**
 * GET /api/calls/:id
 * Get a specific call with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const call = await Call.findById(req.params.id).populate('lead');
    
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    res.json({
      success: true,
      call: {
        id: call._id,
        twilioCallSid: call.twilioCallSid,
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        status: call.status,
        direction: call.direction,
        startTime: call.startTime,
        endTime: call.endTime,
        duration: call.duration,
        formattedDuration: call.formattedDuration,
        transcript: call.transcript,
        conversationSummary: call.conversationSummary,
        callerIntent: call.callerIntent,
        sentiment: call.sentiment,
        leadCaptured: call.leadCaptured,
        lead: call.lead,
        outcome: call.outcome,
        wasTransferred: call.wasTransferred,
        transferredTo: call.transferredTo,
        recordingUrl: call.recordingUrl,
        aiStats: call.aiStats,
        metadata: call.metadata,
        createdAt: call.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch call' });
  }
});

/**
 * GET /api/calls/:id/transcript
 * Get just the transcript for a call
 */
router.get('/:id/transcript', async (req, res) => {
  try {
    const call = await Call.findById(req.params.id).select('transcript conversationSummary');
    
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    res.json({
      success: true,
      transcript: call.transcript,
      summary: call.conversationSummary
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transcript' });
  }
});

/**
 * GET /api/calls/stats/:businessId
 * Get call statistics for a business
 */
router.get('/stats/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      totalCalls,
      completedCalls,
      missedCalls,
      avgDuration,
      callsByIntent,
      callsBySentiment,
      callsByDay,
      leadsFromCalls
    ] = await Promise.all([
      Call.countDocuments({ business: businessId, createdAt: { $gte: startDate } }),
      Call.countDocuments({ business: businessId, status: 'completed', createdAt: { $gte: startDate } }),
      Call.countDocuments({ business: businessId, status: { $in: ['no-answer', 'busy', 'failed'] }, createdAt: { $gte: startDate } }),
      Call.aggregate([
        { $match: { business: businessId, status: 'completed', createdAt: { $gte: startDate } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      Call.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startDate } } },
        { $group: { _id: '$callerIntent', count: { $sum: 1 } } }
      ]),
      Call.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startDate } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } }
      ]),
      Call.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Call.countDocuments({ business: businessId, leadCaptured: true, createdAt: { $gte: startDate } })
    ]);

    res.json({
      success: true,
      stats: {
        period: `${days} days`,
        totalCalls,
        completedCalls,
        missedCalls,
        answerRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : 0,
        avgDuration: avgDuration[0]?.avgDuration ? Math.round(avgDuration[0].avgDuration) : 0,
        leadsFromCalls,
        leadCaptureRate: completedCalls > 0 ? ((leadsFromCalls / completedCalls) * 100).toFixed(1) : 0,
        callsByIntent: callsByIntent.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        callsBySentiment: callsBySentiment.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        callsByDay
      }
    });
  } catch (error) {
    console.error('Error fetching call stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch call statistics' });
  }
});

/**
 * GET /api/calls/recent/:businessId
 * Get recent calls for dashboard
 */
router.get('/recent/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { limit = 10 } = req.query;

    const calls = await Call.find({ business: businessId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('fromNumber status duration conversationSummary callerIntent leadCaptured createdAt');

    res.json({
      success: true,
      calls: calls.map(call => ({
        id: call._id,
        fromNumber: call.fromNumber,
        status: call.status,
        duration: call.duration,
        summary: call.conversationSummary,
        intent: call.callerIntent,
        leadCaptured: call.leadCaptured,
        createdAt: call.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching recent calls:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent calls' });
  }
});

module.exports = router;
