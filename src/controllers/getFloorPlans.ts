export async function getFloorPlansController(req: any, res: any) {
    try {
        const { db } = req.app;
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required '});
        }

        const floorPlans = await db.collection('floorplans').find({ userId }).toArray();

        res.status(200).json({
            message: 'Floor plans fetched',
            floorPlans: floorPlans.map(plan => ({
                _id: plan._id,
                floorPlan: plan.floorPlan,
                imageUrl: plan.imageUrl,
                qrCodeUrl: plan.qrCodeUrl || '',  // Provide a default if qrCodeUrl is not set
                zones: plan.zones,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
}