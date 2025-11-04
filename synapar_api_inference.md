# **Synapar Public API Documentation (v0.1.0-mini-alpha)**

This document describes how to call the Synapar (v0.1.0-mini-alpha) model's public inference API.

**Note:** The API is for testing and research purposes only and does not constitute any investment advice or suggestion. We assume no responsibility for any investment or trading behavior based on AI-generated content. Public and free API calls may fail to be accessed due to technical failures, upgrades, or other reasons, or access may be closed after a notification is issued. If the same IP address accesses the API too frequently, access may be restricted.

## **Endpoint**

POST `https://synapar-0-1-0-mini-alpha-frontend.vercel.app/api/synapar_api_inference`

*(Note: In some countries or regions, it may be necessary to enable a VPN beforehand when accessing the endpoint.)*

## **Request**

### **Headers**

| Key | Value |
| :---- | :---- |
| Content-Type | application/json |

### **Body**

The request body must be a JSON object containing the following fields:

| Field | Type | Required | Description                                                                                                                                                                                                           |
| :---- | :---- | :---- |:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| kline\_data | Array\[Array\[Number\]\] | **Yes** | K-line data with shape (N, 7). N is the number of timesteps, and the 7 columns must strictly follow the order: \[timestamp, open, high, low, close, volume, amount\].                                                 |
| frequency | String | **Yes** | The frequency identifier for the K-line data. Must be one of the following values: "1min", "5min", "15min", "30min", "1hour", "4hour", "1day", "1week".                                                               |
| kline\_window\_size | Number | No | (Optional) The maximum context length. The model will use this length to truncate the last N records of kline\_data. **Must be greater than the model's minimum context length (128+16)**. Default: 256\. Max: 1024\. |
| confidence\_threshold | Number | No | (Optional) Confidence threshold. The simulation will ignore long or short signals with a confidence lower than this value. Range \[0, 1\]. Default: 0.5.                                                              |

### **Request Example (curl)**

curl \-X POST 'https://synapar-0-1-0-mini-alpha-frontend.vercel.app/api/synapar_api_inference' \\  
\-H 'Content-Type: application/json' \\  
\-d '{  
    "frequency": "1day",  
    "kline\_window\_size": 256,  
    "confidence\_threshold": 0.5,  
    "kline\_data": \[  
        \[1678886400, 100, 105, 98, 102, 10000, 1020000\],  
        \[1678972800, 102, 110, 101, 108, 12000, 1296000\],  
        \[1679059200, 108, 109, 105, 106, 8000, 856000\]  
    \]  
}'

*(Note: In actual use, the kline\_data array must contain at least kline\_window\_size records to get valid inference results, otherwise an error will be returned. kline\_window\_size must be between [128+16, 1024].)*

## **Response**

### **Success Response (200 OK)**

Returns a JSON object containing the model's inference results and simulated trading data based on simplified rules.

The model's output comprises three key elements: direction, quantity, and leverage.

* Direction: Includes three distinct instructions — Long, Short, and Hold — along with their respective confidence scores.
* Quantity: A floating-point value within the [-1, 1] range. A positive value signifies the proportion of available capital to be used for opening or increasing a position. A negative value signifies the proportion of current holdings to be liquidated or reduced.
* Leverage: A floating-point value within the [0, 1] range, indicating the proportion of the permissible leverage (e.g., within a 1x to 20x range) to apply to the trade. This value is not applicable when closing or reducing a position.

*(Note: To ensure sufficient historical context, no trades are made in the first 128 steps of each sequence.)*

{  
    "model\_actions": \[  
        {  
            "action\_type": "hold",  
            "quantity\_ratio": 0.0,  
            "leverage\_ratio": 0.0,  
            "confidence": 0.0  
        },  
        // ... (N actions)  
        {  
            "action\_type": "long",  
            "quantity\_ratio": 0.5123,  
            "leverage\_ratio": 0.2345,  
            "confidence": 0.85  
        }  
    \],  
    "model\_simulation\_results": {  
        "max\_drawdown": 0.153,  
        "sharpe\_ratio": 1.25,  
        "final\_return\_rate": 0.45  
    },  
    "model\_trade\_log": \[  
        {  
            "step": 130,  
            "type": "open",  
            "direction": "long",  
            "price": 105.5,  
            "quantity": 47.39,  
            "fee": 25.0,  
            "available\_funds": 4975.0  
        }  
    \],  
    "model\_account\_history": \[  
        {  
            "step": 128,  
            "total\_assets": 10000.0,  
            "available\_funds": 10000.0,  
            "position\_market\_value": 0.0,  
            "position\_direction": "hold",  
            "position\_quantity": 0.0,  
            "avg\_open\_price": 0.0,  
            "action": "hold",  
            "confidence": 0.0,  
            "details": "Initial state"  
        }  
        // ... (subsequent steps)  
    \],  
    "model\_asset\_curve": \[  
        10000.0,  
        10000.0,  
        // ... (N asset values)  
        14500.0  
    \]  
}

### **Failure Response**

* **400 Bad Request**: The request body does not comply with the specification (e.g., missing kline\_data or frequency, or incorrect kline\_data shape).  
  {  
      "detail": "Request body error"  
  }

* **405 Method Not Allowed**: An HTTP method other than POST was used.  
* **500 Internal Server Error / 502 Bad Gateway**: An internal error occurred in the Vercel proxy or Hugging Face backend (e.g., inference failure, HF Space is down, K-line data is too short, etc.).  
  {  
      "detail": "Hugging Face API Error (Status 500)",  
      "hf\_response\_body": "..." // Original error message from the HF backend  
  }  
