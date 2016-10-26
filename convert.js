#!/usr/bin/env node

const traverse = require("traverse");
const fs = require('fs');

function updateNodeProperty(current, property, value){
    var node = current.node;
    if (current.node[property] !== "unbounded") {
        node[property] = value;
        current.update(node);
    }
}

function convertToInt(current, property) {
    if (typeof current.node === 'object' && current.node[property]) {
        if (current.node[property] !== "unbounded") {
            updateNodeProperty(current, property, parseInt(current.node[property], 10));
        }
    }
}

fs.readFile(process.argv[2], 'utf8', function (err,data) {
    if (err) {
        console.log("use the following format ./convert.js {path to raw schema} > {target file name}");
        return console.log(err);
    }
    data = JSON.parse(data);
    traverse(data).forEach(function(x) {
        // replace minItems and maxItems with ints rather than strings
        convertToInt(this, 'minItems');
        convertToInt(this, 'maxItems');
        
        // sort out the top and second level elements
        if (typeof this.node === 'object' && this.node.allof) {
            // make the top level element mandatory
            var rootPath = this.parent.parent.path.slice();
            rootPath.push('required');
            traverse(data).set(rootPath, [this.key]);

            // convert allof to properties
            const array = this.node.allof;
            var properties = {};
            for (var i in array) {
                var element = array[i];
                var name = element['$ref'].split('/')[1];
                // if the item is unbounded then it's an array and should have the below extra specifications
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

        // If a node is a property and does not have minItems or has minItems greater than 0
        // then it should be marked as mandatory
        if (this.level > 2 && "properties" === this.parent.key &&
            (this.node.minItems > 0 || !this.node.minItems)) {
            // call split to clone array
            var path = this.parent.parent.path.slice();
            path.push('required');
            var required = traverse(data).get(path);
            if (required) {
                required.push(this.key);
                traverse(data).set(path, required);
            } else {
                traverse(data).set(path, [this.key]);
            }
        }

        // If an object is marked as optional it is incorrectly specified as an array, change it to it's raw type.
        if (this.node.type === "array" && !this.node.items['$ref']) {
            this.update({
                "type": this.node.items.type,
            });
        }
    });
    console.log(JSON.stringify(data, null, 4).replace(/#definitions/g, '#/definitions'));
});