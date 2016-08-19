var request = require('request');
var async = require('async');

// References:
// developer.foursquare.com
// https://github.com/nolim1t/nolim1t-foursquare/blob/master/lib/foursquare.coffee
// https://github.com/nolim1t/dont-overstay/blob/master/lib/dont-overstay.rb
module.exports = {
  redirecturl: function(info, callback) {
    callback({status: "OK", url: "https://foursquare.com/oauth2/authorize" + '?client_id=' + info.access_token + '&response_type=code&redirect_uri=' + encodeURIComponent(info.redirect)});
  },
  verifytoken: function(info,callback) {
    var response =  {status: "Please specify a 'code'"};

    if (info.code != undefined) {
      var response =  {status: "Please specify a 'code'"};
      var url = "https://foursquare.com/oauth2/access_token" + '?client_id=' + info.access_token + '&grant_type=authorization_code&client_secret=' + encodeURIComponent(info.access_secret) + '&redirect_uri=' + encodeURIComponent(info.redirect) + '&code=' + encodeURIComponent(info.code);
      request({method: "GET", uri: url}, function(err, res, body) {
          response["status"] = "OK";
          response["body"] = JSON.parse(body);
          callback(response);
      });
    } else {
      callback(response);
    }
  },
  checkinhistory: function(info, callback) {
    var response =  {status: "Invalid 'token' value"};
    if (info.token != undefined) {
      var currentTS = parseInt(new Date().getTime() / 1000);
      var one_eighty_days_ago = currentTS - (7776000 * 2); // 180 days ago
      var ninety_days_ago = currentTS - 7776000; // 90 days ago
      var four_weeks_ago =  currentTS - 2419200; // 4 weeks
      var one_week_ago = currentTS - 604800; // 1 week ago
      var checkinHistory = [];
      var functionParams = {token: info.token, beforeTimestamp: (currentTS + 3600).toString(), afterTimestamp: ninety_days_ago.toString()};
      var fetchHistoryFunc = function(fetchHistoryInfo, fetchResult) {
        if (fetchHistoryInfo.token != undefined && fetchHistoryInfo.afterTimestamp != undefined && fetchHistoryInfo.beforeTimestamp != undefined) {
          var fetchHistoryUrl = "https://api.foursquare.com/v2/users/self/checkins?oauth_token=" + fetchHistoryInfo.token.toString() + '&limit=100&sort=oldestfirst&beforeTimestamp=' + fetchHistoryInfo.beforeTimestamp.toString() + '&afterTimestamp=' + fetchHistoryInfo.afterTimestamp.toString() + '&v=20160226';
          request({method: "GET", uri: fetchHistoryUrl}, function(faerr, fares, fabody) {
            if (!faerr) {
              fetchResult({status: "OK", body: JSON.parse(fabody), url: fetchHistoryUrl});
            } else {
              fetchResult({status: "Request Error"});
            }
          });
        } else {
          fetchResult({status: "Bad Parameters"});
        }
      };
      var asyncFunctionCallback = function(asyncCB){
        if (asyncCB.status == "OK") {
            var checkins = asyncCB.body.response.checkins.items;
            for (var c in checkins) {
              checkinHistory.push(checkins[c]); // Push 1 by 1
            }
            var lastcheckin = checkins[checkins.length - 1];
            if (checkins.length > 99) {
              // Keep populating if its 100 checkins
              functionParams.afterTimestamp = (parseInt(lastcheckin["createdAt"])).toString();
              //console.log(functionParams);
              fetchHistoryFunc(functionParams, asyncFunctionCallback);
            } else {
              // Version
              response["status"] = 'OK'; // Return OK status
              response["url"] = asyncCB.url;
              response["history"] = checkinHistory;
              callback(response);
            }
        }
      }
      fetchHistoryFunc(functionParams, asyncFunctionCallback);
    } else {
      callback(response);
    }
  }
};
