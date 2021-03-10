const request = require("request");
const handlebars = require("handlebars");
const units = require("convert-units");

module.exports = function (app) {
    let plugin = {
        unsubscribes: []
    };

    let hbTemplate;
    let count = 0;
    let validTypes = ["boolean", "number", "bigint", "string"];

    plugin.id = "signalk-webapi-upload";
    plugin.name = "WebAPI data upload";
    plugin.description = "Uploads data to a webapi service. Uses Handlebars template to generate JSON that is posted to the specified server, uses Convert-Units to convert output data to the proper units.";

    //Handlebars helper to assist in flattening data if necessary for the output JSON
    handlebars.registerHelper("getValueByName", function(value1, value2) {
      return (value1.find((x) => x.name === value2) ?? { value: "" }).value;
    });

    plugin.start = function (options) {
        if (options.handlebarsTemplate) {
          hbTemplate = handlebars.compile(options.handlebarsTemplate);
        }

        let stream = app.streambundle.getSelfStream("navigation.datetime");
        //Subscribe to time
        if (options && options.interval > 0) {
          stream = stream.debounceImmediate(options.interval * 1000);
        } else {
          stream = stream.take(1);
        }

        // Insert the handler function for stream events into the unsubscribe array
        // so it will be unsubscribed on stop
        plugin.unsubscribes.push(
          stream.onValue(function (datetime) {
            let data = { path: [] };
            options.paths.forEach((pathobj) => {
                app.debug(pathobj.path);
                let val = app.getSelfPath(pathobj.path);
                if(val) {
                  //Only allow valid types
                  if(validTypes.indexOf(typeof(val)) != -1) {
                    if(pathobj.conversionFrom && pathobj.conversionTo) {
                      val = units(val).from(pathobj.conversionFrom).to(pathobj.conversionTo);
                    }
                  } else {
                    val = "";
                  }
                  let item = { name: pathobj.name, value: val };
                  data.path.push(item);
                }
              }
            );

            let outputText = hbTemplate(data);
            app.debug("Template output: " + outputText);
            if (data.path.length > 0) {
              //Ready to upload data
              let uploadOptions = {
                url: options.url,
                method: "post",
                headers: {
                  "accept": "*/*",
                  "content-type" : "application/json"
                },
                body: outputText               
              };
              //Add the custom headers
              if(options.httpHeaders) {           
                options.httpHeaders.forEach(h => {
                  uploadOptions.headers[h.headerName] = h.headerValue;
                });
              }
              app.debug("Headers: " + JSON.stringify(uploadOptions.headers));
              app.debug("Posting to: " + uploadOptions.url);
              request(uploadOptions, function (err, res, body) {
                if(res) {
                  app.debug("Result:" + res.statusCode + " M: " + res.statusMessage);
                  if(res.statusMessage !== 200) {
                    app.debug("Server returned: " + body);
                  }
                }
                else {
                  app.debug("No Result from webapi post");
                }
                if(err) {
                  app.debug("WebAPI Error: " + err.title + " Desc:" + err.description);
                  app.debug("Server returned: " + body);
                } else {
                  app.debug("No error");
                }
              });
            }
            app.debug("Interval reached,value passed: " + datetime.toString());
          })
        );
    };

    plugin.stop = function () {
        plugin.unsubscribes.forEach((f) => f());
        plugin.unsubscribes = [];
        // Here we put logic we need when the plugin stops
        app.debug("Plugin stopped");
    };

    plugin.schema = {
      // The plugin schema
      type: "object",
      required: ["interval", "url", "handlebarstemplate"],
      properties: {
        url: {
          type: "string",
          title: "API Url",
          description: "WebAPI POST URL"
        },
        interval: {
          type: "number",
          title: "Update Frequency (seconds)",
          default: 60
        },
        handlebarsTemplate: {
          title: "Handlebars Template",
          description: "A handlebars template that is used to format the output data.  See handlebars.js and my docs for more details.",
          type: "string"
        },
        httpHeaders: {
          type: "array",
          title: "Http Headers",
          description: "Custom HTTP headers to send with the request. Add any headers your WebAPI service requires.",
          items: {
            type: "object",
            properties: {
              headerName: {
                type: "string",
                title: "Header Name"
              },
              headerValue: {
                type: "string",
                title: "Header Value"
              }
            }
          }
        },
        paths: {
          title: "Paths",
          description: "List of paths to include in the output data.",
          type: "array",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                title: "Path",
                description: "SignalK path to a specific value. Must resolve to a real number or string, not an object."
              },
              name: {
                type: "string",
                title: "Output Name",
                description: "The output name for the value, all data is structured as an array of name/value pairs"
              },
              conversionFrom: {
                title: "Conversion From",
                description: "The type that the value is to be converted from. See https://www.npmjs.com/package/convert-units for the possible units.",
                type: "string"
              },
              conversionTo: {
                title: "Conversion To",
                description: "The type that the value is to be converted to. See https://www.npmjs.com/package/convert-units for the possible units.",
                type: "string"
              }
            }
          }
        }
      }
    };

    return plugin;
};
