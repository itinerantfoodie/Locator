var https = require('https');
var uuid = require('node-uuid');
var doc = require('dynamodb-doc');
var dynamo = new doc.DynamoDB();
var uuid = require('node-uuid');
var foursquare = require('./lib/foursquare');

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
                    // The new way of doing things
                    foursquare.checkinhistory({token: oauth_token}, function(cb) {
                      response["status"] = cb["status"];
                      if (cb["history"] != undefined) {
                        var checkinHistory = cb["history"].reverse();
                        var lastCheckin = checkinHistory[0];
                        var checkinIsVisible = true;
                        if (lastCheckin.visibility != undefined) {
                          checkinIsVisible = false;
                          console.log("Checkin not visible");
                        } else {
                          console.log("Checkin is visible");
                        }
                        if (checkinIsVisible == false) {
                          for (var i = 1; i < checkinHistory.length; i++) {
                            var checkinHistoryItem = checkinHistory[i];
                            // If there is no visibility set for this checkin its good assuming we haven't already found a non off the grid checkin
                            if (checkinHistoryItem.visibility == undefined && checkinIsVisible == false) {
                              // Set lastCheckin to the next item thats available
                              lastCheckin = checkinHistoryItem;
                              checkinIsVisible = true;
                            }
                          }
                        }
                        var whereObj = {name: "Off the Grid!", code: "XX", country: "Off the Grid!"};
                        if (checkinIsVisible == true) {
                          // Do database and display
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
                          whereObj = {name: lastCheckinLocation.country, code: lastCheckinLocation.cc, country: lastCheckinLocation.country};
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
                        }
                        response.status = "OK";
                        response.meta.status = 200;
                      } else {
                        response.meta.status = 400;
                      }
                      context.succeed(response); // Return response
                    });
                  } else {
                    // Use cached entry
                    if (res.Count == 1) {
                      response.status = "OK";
                      response.meta.status = 200;
                      response.meta.msg = response.status;
                      response["where"] = res.Items[0]["where"];
                    } else {
                      response.status = "OK";
                      response.meta.status = 200;
                      response.meta.msg = response.status;
                      // Show last locator record
                      response["where"] = res.Items[res.Items.length - 1]["where"];
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
