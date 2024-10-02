import { ObjectId } from 'mongodb';

export async function getFloorPlanByIdController(req, res) {
    try {
      const { db } = req.app;  
      const { floorPlanId } = req.params;
      console.log('Received floorPlanId:', floorPlanId);
  
      if (!floorPlanId) {
        return res.status(400).json({ message: 'Floor plan ID is required' });
      }
  
      let objectId;
      try {
        objectId = new ObjectId(floorPlanId);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid floor plan ID format.' });
      }
  
      const floorPlan = await db.collection('floorplans').findOne({ _id: objectId });
  
      if (!floorPlan) {
        console.log('No floor plan found with ID:', floorPlanId);
        return res.status(404).json({ message: 'Floor plan not found' });
      }
  
      res.status(200).json(floorPlan);
    } catch (error) {
      console.error('Error fetching floor plan:', error);
      res.status(500).json({ error: error.toString() });
    }
  }