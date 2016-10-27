# convert-ea-json-schema
Converts the json schema exported from EA13Beta to a valid json schema format. 
Once the conversions have taken place the final schema is validated against the v4 master json schema.

## Installation
Download package from github;
git clone https://github.com/rab206/convert-ea-json-schema.git
Install node packages;
npm install
Execute script;
./convert.js {path to raw schema} > {target file name}

## Conversions
These are the issues in the generated files that are fixed by this script

#### minItems and maxItems are exported as strings not integers
Example;
```javascript
"minItems" : "1"
````
Fixed;
```javascript
"minItems" : 1
```

#### The second level elements are generated as allof rather than properties 
Example;
```javascript
"CreateOrderAck": { 
    "type": "object",
    "allof":
    [
        {
             "$ref": "#definitions/order",
             "minItems": "0",
             "maxItems": "unbounded"
        }
    ]
}
```
Fixed;
```javascript
"CreateOrderAck": {
    "type": "object",
    "properties": {
        "order": {
            "type": "array",
            "minItems": 1,
            "items": {
                "$ref": "#/definitions/order"
            }
        }
    },
    "required": [
        "order"
    ]
}
```

#### Top level unbounded arrays are not generated as arrays
Example;
```javascript
{
     "$ref": "#definitions/order",
     "minItems": "0",
     "maxItems": "unbounded"
}
```

#### None of the items are marked as mandatory
Example;
```javascript
"placedDate": {
    "type" : "string"
},
```
Fixed;
```javascript
"required": ["placedDate"]
// in parent object
```

#### Optional items are created as arrays not as properties
Example;
```javascript
"addressLine1": {
	"type" : "array",
	"items" : { "type":"string" },
	"minItems" : "0",
	"maxItems" : "1"
}
```
Fixed;
```javascript
"addressLine1": {
    "type": "string"
},
```

#### Ref definitions do not have the correct url path
Example;
```javascript
"$ref":"#definitions/orderItem"
```
Fixed;
```javascript
"$ref":"#/definitions/orderItem"
```
