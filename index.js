var https = require('https');
var uuid = require('node-uuid');
var doc = require('dynamodb-doc');
var dynamo = new doc.DynamoDB();
var uuid = require('node-uuid');

exports.handler = function(event, context) {
  var dbparams = {
    TableName: event.tablename
  };
  var api_refresh_time = parseInt(event.refreshtime); // How hold is too old data?

  console.log('Received event:', JSON.stringify(event, null, 2));
  var response = {
    "meta": {
      "status": 400,
      "msg": "Missing Parameters"
    },
    "status": "Missing Parameters"
  }
  if (event.action != "") {
    switch (event.action) {
      case "ping":
        response.status = "PONG";
        response.meta.status = 200;
        response.meta.msg = response.status;
        context.succeed(response);
        break;
      case "locate":
        response.status = "Require parameter: oauth";
        if (event.oauth != "") {
            var oauth_token = event.oauth;
            // If oauth token exists
            var query = {
              TableName: dbparams.TableName
            };
            var now = Math.floor(new Date().getTime() / 1000);
            dbparams.Item = {
              identifier: uuid.v4().toString(),
              authtoken: oauth_token
            };
            dbparams.Item.ts = now;
            query.FilterExpression = 'ts < :now and ts > :some_time_ago and authtoken = :authtoken'
            query.ExpressionAttributeValues = {':some_time_ago' : now - api_refresh_time, ':now' : now, ':authtoken': oauth_token}
            dynamo.scan(query, function(err, res) {
                if (!err) {
                  if (res.Count == 0) {
                    // Lets grab some data if the record is old
                    var url = "https://api.foursquare.com/v2/users/self?oauth_token=" + oauth_token + "&v=20160226";
                    https.get(url, function(res) {
                      var body = '';
                      res.on('data', function(d) {
                          body += d;
                      });
                      res.on('end', function() {
                        try {
                            var respObj = JSON.parse(body);
                        } catch (e) {
                            // Handle exceptions
                            response["status"] = "An internal error has occured while parsing the response from the remote service - " + e.toString();
                        }
                        if (respObj.meta.code == 200) {
                          response["status"] = "OK";
                          var checkinObj = respObj.response.user.checkins;
                          var lastCheckin = checkinObj.items[0];
                          var lastCheckinLocation = lastCheckin.venue.location;
                          var lastCheckinTS = lastCheckin.createdAt;
                          var lastCheckinVenueId = lastCheckin.venue.id;
                          var locationString = "";
                          if (lastCheckinLocation.city !== undefined) {
                              locationString = lastCheckinLocation.city;
                          }
                          if (lastCheckinLocation.country !== undefined) {
                              if (locationString !== "") {
                                  locationString = locationString + ", ";
                              }
                              locationString = locationString + lastCheckinLocation.country
                          }
                          var whereObj = {name: lastCheckinLocation.country, code: lastCheckinLocation.cc, country: lastCheckinLocation.country};
                          if (lastCheckinLocation.city !== undefined) whereObj.city = lastCheckinLocation.city;
                          if (lastCheckinLocation.state !== undefined) whereObj.state = lastCheckinLocation.state;
                          if (lastCheckinVenueId !== undefined) whereObj.foursquareid = lastCheckinVenueId;
                          if (lastCheckinTS !== undefined) whereObj['lastseen_timestamp'] = lastCheckinTS;
                          response["where"] = whereObj;
                          // Store record
                          dbparams.Item["where"] = whereObj;
                          dynamo.putItem(dbparams, function(db) {
                          });
                          response["record"] = dbparams.Item["identifier"]
                          response.status = "OK";
                          response.meta.status = 200;
                        } else {
                          response["status"] = respObj.meta.msg;
                          response.meta.status = respObj.meta.code;
                        }
                        response.meta.msg = response.status;
                        context.succeed(response);
                      }); // Finish processing
                    });
                  } else {
                    // Use cached entry
                    if (res.Count == 1) {
                      response.status = "OK";
                      response.meta.status = 200;
                      response.meta.msg = response.status;
                      response["where"] = res.Items[0]["where"];
                    } else {
                      response.status = "too many locator records";
                      response.meta.status = 500;
                      response.meta.msg = response.status;
                      // Too many records
                      response["where"] = {
                        "name":"Unknown",
                        "state":"Unknown",
                        "code":"XX",
                        "country":"Unknown",
                        "city":"Unknown"
                      }
                    }
                    context.succeed(response);
                  }
                } else {
                  response["status"] = "Query Error";
                  response.meta.status = 500;
                  response.meta.msg = response.status;
                  response["err"] = err;
                  context.succeed(response);
                }
            });
        } else { // No Oauth token
          response.meta.status = 400;
          response.meta.msg = response.status;
          context.succeed(response);
        } // End checking
        break;
      default:
        response.status = "Invalid action";
        response.meta.status = 400;
        response.meta.msg = response.status;
        context.succeed(response);
    }
  } else {
    response.status = "Missing parameters"
    response.meta.status = 400;
    response.meta.msg = response.status;
    context.succeed(response);
  }
};
