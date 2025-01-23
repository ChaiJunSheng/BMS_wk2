const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand , ScanCommand} = require('@aws-sdk/lib-dynamodb');
require("dotenv").config();

export async function set_up(app) {
  // Create DynamoDB client

  const dynamoDbClient = new DynamoDBClient({
    region: process.env.DYNAMO_REGION,
    credentials: {
      accessKeyId: process.env.DYNAMO_ACCESSKEY,
      secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY,
    },
  });
  const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

}

function processValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle nested objects and maps
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

export async function dynamo_insertItem(TableName: string, item: any): Promise<void> {

  const params = {
    TableName: TableName,
    Item: item,
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION,
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY,
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY,
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    const data = await docClient.send(new PutCommand(params));
    console.log('Item inserted successfully');
  } catch (err) {
    console.error('Error inserting item:', err);
  }
}

export async function dynamo_getItem_by_pk(TableName: string, keyAttributes: { [key: string]: string | number }): Promise<any | null> {

  const params = {
    TableName: TableName,
    Key: keyAttributes,
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION || '',
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY || '',
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY || '',
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    const data = await docClient.send(new GetCommand(params));
    
    if (data.Item) {
      console.log('Item retrieved successfully');
      return data.Item;
    } else {
      console.log('No item found');
      return null;
    }
  } catch (err) {
    console.error('Error retrieving item:', err);
    throw err;
  }
}

export async function dynamo_searchByAttribute(TableName: string, attributeName: string, attributeValue: string | number | boolean): Promise<any[]> {

  const params = {
    TableName: TableName,
    FilterExpression: `#attrName = :attrValue`,
    ExpressionAttributeNames: {
      '#attrName': attributeName
    },
    ExpressionAttributeValues: {
      ':attrValue': attributeValue
    }
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION || '',
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY || '',
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY || '',
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    let items: any[] = [];
    let lastEvaluatedKey;

    do {
      if (lastEvaluatedKey) {
        params['ExclusiveStartKey'] = lastEvaluatedKey;
      }

      const data = await docClient.send(new ScanCommand(params));
      
      if (data.Items) {
        items = items.concat(data.Items);
      }

      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${items.length} items matching the attribute`);
    return items;
  } catch (err) {
    console.error('Error searching items by attribute:', err);
    throw err;
  }
}

export async function dynamo_searchByMultipleAttributes(TableName: string, attributes: { [key: string]: string | number | boolean }): Promise<any[]> {

  // Build dynamic filter expression
  const filterExpressions: string[] = [];
  const expressionAttributeNames: { [key: string]: string } = {};
  const expressionAttributeValues: { [key: string]: string | number | boolean } = {};

  Object.entries(attributes).forEach(([key, value], index) => {
    const placeholderName = `#attr${index}`;
    const placeholderValue = `:value${index}`;

    filterExpressions.push(`${placeholderName} = ${placeholderValue}`);
    expressionAttributeNames[placeholderName] = key;
    expressionAttributeValues[placeholderValue] = value;
  });

  const params = {
    TableName: TableName,
    FilterExpression: filterExpressions.join(' AND '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION || '',
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY || '',
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY || '',
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    let items: any[] = [];
    let lastEvaluatedKey;

    do {
      if (lastEvaluatedKey) {
        params['ExclusiveStartKey'] = lastEvaluatedKey;
      }

      const data = await docClient.send(new ScanCommand(params));
      
      if (data.Items) {
        items = items.concat(data.Items);
      }

      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${items.length} items matching all attributes`);
    return items;
  } catch (err) {
    console.error('Error searching items by multiple attributes:', err);
    throw err;
  }
}

export async function dynamo_getLatest(TableName: string): Promise<void> {
  const params = {
    TableName: TableName,
    ScanIndexForward: false,  //Get in reverse order
    Limit: 1  // Get only one item
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION,
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY,
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY,
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    const data = await docClient.send(new  ScanCommand (params));
    console.log('Item retrieved successfully');
  } catch (err) {
    console.error('Error retrieving item:', err);
  }
}

export async function dynamo_getAllItems(TableName: string): Promise<void> {
  const params = {
    TableName: TableName,
  };

  try {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.DYNAMO_REGION,
      credentials: {
        accessKeyId: process.env.DYNAMO_ACCESSKEY,
        secretAccessKey: process.env.DYNAMO_SECRET_ACCESSKEY,
      },
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

    const data = await docClient.send(new  ScanCommand(params));
    console.log('Item retrieved successfully');
  } catch (err) {
    console.error('Error retrieving item:', err);
  }
}

/*
await dynamo_getItem_by_pk('MyTable', { id: '12345' });

const activeUsers = await dynamo_searchByAttribute('Users', 'status', 'active');

const filteredUsers = await dynamo_searchByMultipleAttributes('Users', {
  status: 'active',
  age: 30,
  role: 'admin'
});


*/