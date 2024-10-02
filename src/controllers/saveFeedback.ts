import { ObjectId } from 'mongodb';

export async function saveFeedbackController(req, res) {
    console.log('saveFeedbackController called');
    try {
        const { db } = req.app;
        const { floorPlanId, deviceId, temperatureFeedback, comments } = req.body;

        // Log input data for debugging
        console.log('Received feedback data:', { floorPlanId, temperatureFeedback, comments });

        if (!floorPlanId || !deviceId || !temperatureFeedback) {
            return res.status(400).json({ message: 'Floor plan ID and temperature feedback are required.' });
        }

        // Attempt to convert floorPlanId to ObjectId
        let objectId;
        try {
            objectId = new ObjectId(floorPlanId);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid floor plan ID format.' });
        }

        const existingFeedback = await db.collection('feedback').findOne({ floorPlanId: objectId, deviceId: deviceId });

        if (existingFeedback) {
            const lastFeedbackTime = existingFeedback.timestamp;
            const currentTime = new Date();
            const timeDifference = currentTime.getTime() - new Date(lastFeedbackTime).getTime();
            const hours = 1

            const allowedInterval = hours * 60 * 60 * 1000;

            if (timeDifference < allowedInterval) {
                return res.status(400).json({ message: 'You have already submitted feedback recently. Please try again later'})
            }
        }

        const feedback = {
            floorPlanId: objectId,
            deviceId: deviceId,
            temperatureFeedback,
            comments: comments || '',
            timestamp: new Date(),
        };

        // Insert feedback into the database
        const result = await db.collection('feedback').insertOne(feedback);
        res.status(200).json({ message: 'Feedback saved successfully', feedbackId: result.insertedId });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: error.toString() });
    }
}