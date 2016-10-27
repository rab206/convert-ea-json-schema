#!/usr/bin/env node

const traverse = require("traverse");
const fs = require('fs');
const Ajv = require('ajv');
const ajv = new Ajv({allErrors: true});

// update a single property on a node
// current = this
// property = the property name
// value = the value to set
function updateNodeProperty(current, property, value){
    var node = current.node;
    if (current.node[property] !== "unbounded") {
        node[property] = value;
        current.update(node);
    }
}

// if the node has the propety and it is a number in the string then convert it to a number
function convertToInt(current, property) {
    if (current.node[property]) {
        if (!isNaN(current.node[property])) {
            updateNodeProperty(current, property, parseInt(current.node[property], 10));
        }
    }
}

fs.readFile(process.argv[2], 'utf8', function (err,data) {
    // no real error handling here, just assume it's a json schema file
    if (err) {
        console.log("use the following format ./convert.js {path to raw schema} > {target file name}");
        return console.log(err);
    }
    data = JSON.parse(data);
    
    // traverse every node in the json
    traverse(data).forEach(function() {
        // replace minItems and maxItems with ints rather than strings
        convertToInt(this, 'minItems');
        convertToInt(this, 'maxItems');
        
        // sort out the top and second level elements
        if (this.node.allof) {
            // make the top level element mandatory
            var rootPath = this.parent.parent.path.slice();
            rootPath.push('required');
            traverse(data).set(rootPath, [this.key]);

            // convert all of the nodes inside allof to properties
            const array = this.node.allof;
            var properties = {};
            for (var i in array) {
                var element = array[i];
                // get the name of the element
                var name = element['$ref'].split('/')[1];
                // if the item is unbounded then it's an array and should have the below extra specifications
                // other array elements in "properties" are generated correctly
                if (element.maxItems === 'unbounded') {
                    properties[name] = {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "$ref": element['$ref']
                        }
                    };
                } else {
                    // otherwise just need to simplify the object
                    properties[name] = {
                        '$ref': element['$ref']
                    };
                }

            }
            this.update({
                "type": "object",
                "properties": properties
            });
        }

        // If a node is a property and (does not have minItems or has minItems greater than 0)
        // then it should be marked as mandatory
        if (this.level > 2 && "properties" === this.parent.key &&
            (this.node.minItems > 0 || !this.node.minItems)) {
            // call slice to clone array
            var path = this.parent.parent.path.slice();
            // create the "required" path
            path.push('required');
            // add the new property to the required array
            var required = traverse(data).get(path);
            if (required) {
                required.push(this.key);
                traverse(data).set(path, required);
            } else {
                traverse(data).set(path, [this.key]);
            }
        }

        // If an object is marked as optional it is incorrectly specified as an array, so need to change it to it's raw type.
        // Unless the object is an array of references in which case it is generated correctly
        if (this.node.type === "array" && !this.node.items['$ref']) {
            this.update({
                "type": this.node.items.type,
            });
        }
    });
    
    // add the leading slash to definitions globally
    // output the json schema with 4 spaces
    var res = JSON.stringify(data, null, 4).replace(/#definitions/g, '#/definitions');
    
    // validate the updated raw schema against the master json schema v4
    var valid = ajv.validateSchema(data);
    if (!valid){
        console.error("Invalid schema generated ", ajv.errors);
        console.log(res);
    } else {
        console.log(res);
    }
});