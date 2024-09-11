export async function ssController(req: any, res: any) {
    try {
      console.log("SECOND");

      res.status(200).json({
        message: "Customers retrieved",
      });
  
    }
    catch(error) {
      res.status(500).json({ error: error.toString() });
    }
  }