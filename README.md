# signalk-webapi-upload

SignalK Node Server WebAPI Upload Plugin

Allows upload of specific data paths from a SignalK Node server to any WebAPI service at a fixed interval of time.  Can be used to upload data regularly to a weather service, a custom web service, or any WebAPI service you wish to have regular updates sent to from your SignalK server.

Can post to any WebAPI that accepts a JSON payload.  Does not support authentication or client certificates.

Uses Handlebars to template the data format into the format expected by the WebAPI service you wish to post to.

## Configuration

##### API URL
Set to the URL that data should post to.

##### Update Frequency
Set to the number of seconds between updates, this is based on your navigation clock and is set in seconds. The intention of this plugin is to post a small amount of data on an infrequent basis, I recommend setting this to 10 seconds or greater.

##### Handlebars Template
Documentation on handlebars.js: __[handlebarsjs.com](https://handlebarsjs.com)__

A handlebars.js template to transform the data from the standardized name/value pair array into the format the target WebAPI expects.  The data is prepared by the plugin as an array of name/value pairs:

``` js
{
    path: [
        {"name":"lat","value":"59.7122406"}, 
        {"name":"lon","value":"24.7288183"}, 
        {"name":"depth","value":"12.779"}
    ]
}
```
Each item in the array is created by the paths specified in the paths configuration. The name is equal to the name specified for the path, you can make it anything you want.  Once the data is prepared from your list of paths, it is passed to the handlebars.js template for processing.  

``` js
[
    {{#each path }}
        {"N":"{{this.name}}","V":"{{this.value}}"}{{#unless @last}},{{/unless}}
    {{/each}} 
]
```
This template will output as the following:
```
[ 
    {"N":"lat","V":"59.7178682"}, 
    {"N":"lon","V":"24.733011"}, 
    {"N":"depth","V":"21.009"}
]
```
The data has been changed from pairs of Name/Value to N/V pairs.  The unless syntax suppresses a trailing comma at the end of the list.
To assist with flattening the output, I've added a custom helper that can perform a look up of a particular path and return it's value.  To create something that might work for windy.com's API:
```
{
   "stations":
   [
		{ "station":"0", "name":"My Home Station", "lat":"{{getValueByName path 'lat'}}", "lon":"{{getValueByName path 'lon'}}", "elevation":"0", "tempheight":"2", "windheight":"10"}
	],
	"observations":[
		{ "station":"0", "temp":"{{getValueByName path 'temp'}}", "wind":"{{getValueByName path 'wspd'}}", "winddir":"{{getValueByName path 'wang'}}" }
	]
}
```
If you aren't sure how to create a Handlebars template for the service you want to post to, feel free to contact me.
##### Http Headers
Add any additional HTTP headers that are needed by the webservice you are posting to.
##### Paths
###### Path
Add paths to the paths collection. Each path must resolve to a numeric, string or boolean value, not an object property.
This is valid
+ *navigation.position.value.latitude*
  + resolves to a numeric i.e. **32.7813**

This is invalid
+ *navigation.position.value*
  + resolves to an object with properties i.e. **{ latitude: 32.123, longitude: 123.12 }**

Invalid paths will have a value of empty string.
###### Name
Set the Output Name of your path to the name you want to give it in the data sent to your Handlebars template.  You can set the name the same as the path if you don't want to rename them.

###### Conversion From/To
This plugin uses convert-units __[convertunits](https://github.com/ben-ng/convert-units#readme)__ to convert data from one unit of measure to another.  This allows you to convert from Kelvin to F or Meters to Feet anyway that you desire.  The conversion is done as the data is prepared for upload so that your target web service will receive the data in the units expected.  

Some examples: 
+ From: **m/s** To: **m/h** (Convert from meters per second to miles per hour)
+ From: **K** To: **F** (Convert from degrees Kelvin to degrees F)
+ From **rad** To: **deg** (Convert from radians to degrees)
