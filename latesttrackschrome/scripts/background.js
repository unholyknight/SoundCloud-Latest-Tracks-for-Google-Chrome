/*************************************************************
	Background.js
	- contains html5 audio
	- incData contains
	  + [0] track information to pass to popup.html
	  + [1] track streaming URLs
	  + [2] track favorite data
	  + [3] track id number
	- takes control cues from popup.html for playback changes,
	  favoriting/unfavoriting of tracks, and displaying/posting
	  comments.
	
	Note: parseInt used when any data is communicating through
	      chrome's native request functionality. Data passed
	      is sometimes read as a string.
/************************************************************/

// Global variables
var tNew = 0, tNewCount = 0, fNew = 0, autoplay = 0, comments = 0, view = "inc", viewlength = 0, misc = 0, miscNew = 0, miscProper = "", responseCount = 0, responseMax = 0, looping = "off", miscString = "";
var incData = [[],[],[],[]];
var favData = [[],[],[],[]];
var miscData = [[],[],[],[]]
var token, limit, intTimer, buffered, buffTimer, current = 0, linkcount, inc;

// Connect to SoundCloud, setup for latest track fetching
function initialize(fetch, inToken, inLimit, inInterval) {
	var i = 0;
	if (inToken != undefined) {
		clearInterval(intTimer);
		token = inToken;
		limit = inLimit;
		SC.initialize({
			client_id: "2b161e5544f1f7f4cab5ff3c76c6c7b8",
			access_token: token
		});
		intTimer = setInterval(updateTracks, 60 * inInterval * 1000);
		if (fetch === 1) {
			for (i = 0; i < incData.length; i++) {
				incData[i].length = 0;
			}
			for (i = 0; i < favData.length; i++) {
				favData[i].length = 0;
			}
			fetchTracks("/me/activities/tracks", "inc", 0, 0);
			fetchTracks("/me/favorites", "fav", 0, 0);
		}
	}
	else {
		clearInterval(intTimer);
	}	
}

// Initialize extension on load
initialize(0, localStorage.token, localStorage.limit, localStorage.interval);

function pushData(array, op, a, b, c, d){
	if(op === "push"){
		array[0].push(a);
		array[1].push(b);
		array[2].push(c);
		array[3].push(d);
	}
	if(op === "unshift"){
		array[0].unshift(a);
		array[1].unshift(b);
		array[2].unshift(c);
		array[3].unshift(d);
	}
}

function crunchCollection(incoming, type, notify, more) {
	$.each(incoming, function () {
		var track = this.origin;
		if (track.title !== undefined && track.streamable) {
			var op = "push";
			var trackString = formatTrack(track.title, track.user.permalink, track.user.username, track.waveform_url,
								track.permalink_url, track.artwork_url, track.download_url,
								track.purchase_url, track.genre, track.commentable);
			if ($.inArray(trackString,incData[0]) < 0 && $.inArray(track.id,incData[3]) < 0) {
				if (notify === 1) {
					tNew++;
					op = "unshift";
				}
				pushData(incData, op, trackString, track.stream_url, track.user_favorite, track.id);
			}
		}
	});
}

function crunchIncoming(incoming, type, notify, more) {
	responseCount = 0;
	responseMax = incoming.length;
	for(var i=0; i<incoming.length; i++){
		if (incoming[i].title !== undefined && incoming[i].streamable) {
			var op = "push";
			var trackString = formatTrack(incoming[i].title, incoming[i].user.permalink, incoming[i].user.username, incoming[i].waveform_url,
								incoming[i].permalink_url, incoming[i].artwork_url, incoming[i].download_url,
								incoming[i].purchase_url, incoming[i].genre, incoming[i].commentable);
			if(type === "fav"){
				if ($.inArray(trackString,favData[0]) < 0 && $.inArray(incoming[i].id,favData[3]) < 0) {
					if (notify === 1) {
						fNew++;
						op = "unshift";
					}
					pushData(favData, op, trackString, incoming[i].stream_url, incoming[i].user_favorite, incoming[i].id);
				}
			}
			else{
				if ($.inArray(trackString,miscData[0]) < 0 && $.inArray(incoming[i].id,miscData[3]) < 0) {
					var stream = incoming[i].stream_url;
					var id = incoming[i].id;
					if (notify === 1) {
						miscNew++;
						op = "unshift";
					}
					pushData(miscData, op, trackString, stream, 0, id);
					SC.get("/me/favorites/" + incoming[i].id, function (exist, error) {
						if(error){ 
							// stream is already listed as not a favorite
						}
						else{ 
							for(var j=0; j<miscData[3].length; j++){
								if(miscData[3][j] === exist.id){ miscData[2][j] = 1; }
							}
						}
						if(responseCount == responseMax - 1){
							chrome.extension.sendRequest({requestlist: "readymoreartists"});
						}
						responseCount++;
					});	
				}
			}
		}
	}
}

// Fetch latest tracks from SoundCloud and notify user of new tracks
function fetchTracks(stream, type, notify, more) {
	var fetchLimit = limit;
	if (more === 1) { 
		if(type === "inc"){ fetchLimit = incData[0].length + parseInt(limit); }
		else if(type === "fav"){ offset = favData[0].length; }
		else{ offset = miscData[0].length; }
	}
	else { offset = 0; }
	SC.get(stream + "?limit=" + fetchLimit + "&offset=" + offset, function (incoming) {
		if(!incoming.collection){ crunchIncoming(incoming, type, notify, more); }
		else{ crunchCollection(incoming.collection, type, notify, more); }
		if(type === "inc"){
			if (tNew > 0) {
				tNewCount = tNewCount + tNew;
				chrome.browserAction.setBadgeText({text: tNewCount + ""});
				if (view === "inc") {
					viewlength = incData[0].length;
					current = inBounds((parseInt(current) + parseInt(tNew)), viewlength);
				}
				tNew = 0;
				chrome.extension.sendRequest({requestlist: "new"});
			}
			if (notify === 0 && more !== 1) {
				viewlength = incData[0].length;
				trackPlayback(0, view);
			}
			if (more === 1) { chrome.extension.sendRequest({requestlist: "readymoreinc"}); }
		}
		else if(type === "fav"){
			if (view === "fav") { viewlength = favData[0].length; }
			if (fNew > 0) {
				if (view === "fav") { current = inBounds((parseInt(current, 10) + parseInt(fNew, 10)), viewlength); }
				fNew = 0;
				chrome.extension.sendRequest({requestlist: "new"});
			}
			if (more === 1) { chrome.extension.sendRequest({requestlist: "readymorefav"}); }
		}
		else {
			if (view !== "fav" && view !== "inc") { viewlength = misData[0].length; }
			if (miscNew > 0) {
				if (view !== "fav" && view !== "inc") { current = inBounds((parseInt(current, 10) + parseInt(miscNew, 10)), viewlength); }
				miscNew = 0;
				chrome.extension.sendRequest({requestlist: "new"});
			}
			
		}
	});
}

//  Timed update of track listings
function updateTracks() {
	fetchTracks("/me/activities/tracks", "inc", 1, 0);
	fetchTracks("/me/favorites", "fav", 1, 0);
}

// Format fetched track for display
function formatTrack(title, artistid, artist, waveform, link, badge, dl, buy, genre, comment) {
	var formatted = "<a href=\"#\" class=\"tLink\" id=\"" + waveform + "," + link + "," + badge + "," + dl + "," + buy + "," + genre + "," + comment + "," + artistid + "," + artist + "\">" + title + " by " + artist + "</a>";
	return formatted;
}

// Control to make sure that current is within bounds
function inBounds(number, bound) {
	if (number > (bound-1)) {
		number = bound - 1;
	}
	return parseInt(number, 10);
}

// Playback tracker for buffering and playback
function trackPlayback(pos, linkage, auto) {
	var assocData;
	$("#stream").empty();
	if (linkage === "inc") { 
		assocData = incData[1][pos]; 
		view = "inc";
	}
	else if (linkage === "fav") { 
		assocData = favData[1][pos]; 
		view = "fav";
	}
	else {
		assocData = miscData[1][pos];
		view = linkage;
	}
	current = inBounds(parseInt(pos), viewlength);
	buffered = 0;
	buffTimer = setTimeout(tShift, 500);
	// Set audio tag HTML for background, allowing tracks to continue playing while popup is closed
	$("#stream").html("<audio id=\"playing\" name=\"playing\" src=\"" + assocData + "?client_id=2b161e5544f1f7f4cab5ff3c76c6c7b8\" preload=\"auto\"></audio>");
	$("#playing")[0].addEventListener('ended', function () { endPlayback("next"); }, false);
	$("#playing").bind('timeupdate', tShift);
	if (auto) {
		autoplay = 1;
	}
}

// Calculate buffer time and current time for seekbar update and time display
function tShift(sendState) {
	if ($("#playing")[0].readyState > 1) {
		if ($("#playing")[0].paused && autoplay === 1) {
			autoplay = 0;
			$("#playing")[0].play();
			sendState = 1;
		}
		var cWidth = $("#playing")[0].currentTime / $("#playing")[0].duration * 426;
		if (cWidth < 1) { 
			cWidth = 1; 
		}
		buffered = $("#playing")[0].buffered.end($("#playing")[0].buffered.length - 1) / $("#playing")[0].duration * 426;
		var tMin = Math.floor(Math.floor($("#playing")[0].currentTime) / 60), tSec = Math.floor($("#playing")[0].currentTime) % 60,
			dMin = Math.floor(Math.floor($("#playing")[0].duration) / 60), dSec = Math.floor($("#playing")[0].duration) % 60;
		if (tSec < 10) { tSec = "0" + tSec; }
		if (dSec < 10) { dSec = "0" + dSec; }
		chrome.extension.sendRequest({requestlist: "buffer," + Math.round(buffered) + "," + Math.round(cWidth) + "," + tMin + "." + tSec + " / " + dMin + "." + dSec});
	}
	if ($("#playing")[0].paused && buffered !== 426) {
		buffTimer = setTimeout(tShift ,500);
	}
	if (sendState === 1) {
		if ($("#playing")[0].paused) {
			chrome.extension.sendRequest({requestlist: "playstate,play"});
		}
		else {
			chrome.extension.sendRequest({requestlist: "playstate,pause"});
		}
	}
}

// Prep next track for load and play if autoplay is enabled
function endPlayback(track) {
	if (looping === "one") {
		track = parseInt(current);
	}
	else if (looping === "all") {
		track = parseInt(current) + 1;
		if (track >= viewlength) {
			track = 0;
		}
	}
	else {
		track = parseInt(current) + 1;
	}
	if (localStorage.autoplay === "1" && track < viewlength) {
		current = inBounds(parseInt(track, 10), viewlength);
		chrome.extension.sendRequest({requestlist: "next," + current});
		trackPlayback(current, view, 1);
	}
}

// Run initial track fetch (if extension is setup) on extension load
$(function () {
	if (token !== undefined) {
		fetchTracks("/me/activities/tracks", "inc", 0, 0);
		fetchTracks("/me/favorites", "fav", 0, 0);
	}
});

// Chrome extension listener
chrome.extension.onRequest.addListener(
	function (request, sender, sendResponse) {
		var xmlhttp;
		// Send tracks to popup when requested
		if (request.requestlist.substring(0,4) === "give") {
			inc = request.requestlist.split(',');
			if (inc[1] === "startup") {
				if (view === "inc") {
					tNewCount = 0;
					chrome.browserAction.setBadgeText({text:""});
					sendResponse({sendlist: incData[0]});
				}
				if (view === "fav") {
					sendResponse({sendlist: favData[0]});
				}
				else {
					if(view === misc) {
						sendResponse({sendlist: miscData[0]});
					}
				}
			}
			else if (inc[1] === "inc") {
				tNewCount = 0;
				chrome.browserAction.setBadgeText({text:""});
				sendResponse({sendlist: incData[0]});
			}
			else if (inc[1] === "fav") {
				sendResponse({sendlist: favData[0]});
			}
			else {
				if(inc[1] === misc) {
					sendResponse({sendlist: miscData[0]});
				}
				else {
					miscData = [[],[],[],[]];
					misc = inc[1];
					miscString = "/users/" + inc[1] + "/tracks";
					fetchTracks(miscString, "artist", 0, 1);
					sendResponse({});
				}
			}
		}
		// Set proper name for misc tab
		else if (request.requestlist.substring(0,6) === "proper") {
			miscProper = request.requestlist.split(',')[1];
			sendResponse({});
		}
		else if (request.requestlist === "getproper") {
			sendResponse({sendlist: miscProper});
		}
		// Send current view to popup
		else if (request.requestlist === "view") {
			sendResponse({sendlist: view});
		}
		// Reinitialize extension on options change
		else if (request.requestlist.substring(0,6) === "update") {
			inc = request.requestlist.split(',');
			initialize(1, inc[1], inc[2], inc[3]);
			sendResponse({});
		}
		// Force reset
		else if (request.requestlist === "reset") {
			initialize(0, localStorage.token, localStorage.limit, localStorage.interval);
			sendResponse({});
		}
		// Force tShift to update popup player
		else if (request.requestlist === "forceshift") {
			tShift(1);
			sendResponse({});
		}
		// Listener for pause and play
		else if (request.requestlist === "playback") {
			if (buffered > 0) {
				if ($("#playing")[0].paused) {
					clearTimeout(buffTimer);
					$("#playing")[0].play();
				}
				else {
					if (buffered !== 426) {
						buffTimer=setTimeout(tShift, 500);
					}
					$("#playing")[0].pause();
				}
				autoplay = 0;
			}
			sendResponse({});
		}
		// Listener for track seeking
		else if (request.requestlist.substring(0,5) === "scrub") {
			inc = request.requestlist.split(',');
			if (buffered < inc[1]) {
				$("#playing")[0].currentTime = buffered / 426 * $("#playing")[0].duration;
			}
			else {
				$("#playing")[0].currentTime = inc[1] / 426 * $("#playing")[0].duration;
			}
			sendResponse({});
		}
		// Load new track
		else if (request.requestlist.substring(0,12) === "changetracks") {
			inc = request.requestlist.split(',');
			if (inc[1] === "inc") {
				viewlength = incData[0].length;
			}
			else if (inc[1] === "fav") {
				viewlength = favData[0].length;
			}
			else {
				viewlength = miscData[0].length;
			}
			current = inBounds(parseInt(inc[2], 10), viewlength);
			trackPlayback(parseInt(inc[2], 10), inc[1], 1);
			sendResponse({});
		}
		// Send current playing track data string when requested
		else if (request.requestlist === "datastring") {
			if (view === "inc") {
				sendResponse({sendlist: incData[0][current]});
			}
			else if (view === "fav") {
				sendResponse({sendlist: favData[0][current]});
			}
			else {
				sendResponse({sendlist: miscData[0][current]});
			}
		}
		// Send current playing tracks number in list when requested
		else if (request.requestlist === "current") {
			sendResponse({sendlist: current});
		}
		// Send current view that is playing when requested
		else if (request.requestlist === "playview") {
			sendResponse({sendlist: view});
		}
		// Send current tracks favorite status (true or false)
		else if (request.requestlist === "favinfo") {
			if (view === "inc") {
				sendResponse({sendlist: incData[2][current]});
			}
			else if (view === "fav") {
				sendResponse({sendlist: favData[2][current]});
			}
			else {
				sendResponse({sendlist: miscData[2][current]});
			}
		}
		// Loop changes
		else if (request.requestlist === "loopAll") {
			looping = "all";
			sendResponse({});
		}
		else if (request.requestlist === "loopOne") {
			looping = "one";
			sendResponse({});
		}
		else if (request.requestlist === "loopNone") {
			looping = "off";
			sendResponse({});
		}
		else if (request.requestlist === "loopStatus") {
			sendResponse({sendlist: looping});
		}
		// Load more tracks
		else if (request.requestlist.substr(0,8) === "loadmore") {
			if(request.requestlist.substr(8) === "inc") {
				fetchTracks("/me/activities/tracks", "inc", 0, 1);
			}
			else if(request.requestlist.substr(8) === "fav") {
				fetchTracks("/me/favorites", "fav", 0, 1);
			}
			else{
				fetchTracks(miscString, "artist", 0, 1);
			}
		}
		// Save current track as favorite
		else if (request.requestlist === "saveFavorite") {
			var id;
			if(view === "inc"){
				incData[2][current] = 1;
				id = incData[3][current];
			}
			else if (view === "fav"){
				favData[2][current] = 1;
				id = favData[3][current];
			}
			else{
				miscData[2][current] = 1;
				id = miscData[3][current];
			}
			xmlhttp = new XMLHttpRequest(); 
			xmlhttp.open("PUT","https://api.soundcloud.com/me/favorites/" + id + ".json?oauth_token=" + localStorage.token, true); 
			xmlhttp.send(null);
			sendResponse({});
		}
		// Remove current track from favorites
		else if (request.requestlist === "removeFavorite") {
			var id;
			if(view === "inc"){
				incData[2][current] = 0;
				id = incData[3][current];
			}
			else if (view === "fav"){
				favData[2][current] = 0;
				id = favData[3][current];
			}
			else{
				miscData[2][current] = 0;
				id = miscData[3][current];
			}			
			incData[2][current] = false;
			xmlhttp = new XMLHttpRequest(); 
			xmlhttp.open("DELETE","https://api.soundcloud.com/me/favorites/" + id + ".json?oauth_token=" + localStorage.token, true);
			xmlhttp.send(null);
			sendResponse({});
		}
		// Send the comments for the current track when requested
		else if (request.requestlist === "comments") {
			var i, trackComment;
			var commentString = "";
			var comopt = localStorage.comopt;
			if (comopt === undefined) { comopt = 20; }
			if (view === "inc") { trackComment = incData[3][current]; }
			else if (view === "fav") { trackComment = favData[3][current]; }
			else { trackComment = miscData[3][current]; }
			SC.get("/tracks/" + trackComment + "/comments?limit=" + comopt, function (comments) {
				for(i=0; i<comments.length; i++) {
					var avatar = "<a href=\"" + comments[i].user.permalink_url + "\" target=\"_new\"><img src=\"" + comments[i].user.avatar_url.replace('large', 'badge') + "\" alt=\"" + comments[i].user.username + "\" class=\"avatar\"/></a>";
					var username = "<a href=\"" + comments[i].user.permalink_url + "\" target=\"_new\">" + comments[i].user.username + "</a>";
					var timed = "";
					if (comments[i].timestamp !== null) {
						var cMin = Math.floor(Math.floor(comments[i].timestamp / 1000) / 60);
						var cSec = Math.floor((comments[i].timestamp / 1000) % 60);
						if (cSec < 10) { cSec = "0" + cSec; }
						timed = "<span class=\"commentedat\">at " + cMin + "." + cSec + "</span>";
					}
					var date = new Date(comments[i].created_at);
					var now = new Date();
					var posted = Math.floor((now.getTime() - date.getTime()) / 1000);
					if (posted < 60) { posted = posted + " seconds ago"; }
					else if (posted < 2700) { 
						posted = Math.round(posted/60); 
						if (posted === 1) { posted = "1 minute ago"; }
						else { posted = posted + " minutes ago"; }
					}
					else if (posted < 86400) { 
						posted = Math.round(posted/(60*60));
						if (posted === 1) { posted = "about 1 hour ago"; }
						else { posted = "about " + posted + " hours ago"; }
					}
					else {
						posted = Math.round(posted / (60 * 60 * 24));
						if (posted === 1) { posted = "1 day ago"; }
						else { posted = posted + " days ago"; }
					}
					var time = "<span class=\"commented\">" + posted + "</span>";
					commentString = commentString + "<div class=\"acomment\">" + avatar + username + " " + timed + " " + time + "<div class=\"commentbody\">" + comments[i].body + "</div></div>";
				}
				commentString = "<div class=\"addcomment\"><h3>Add a new comment</h3><textarea id=\"newcomment\"></textarea><input id=\"postcomment\" type=\"submit\" value=\"Post comment\"/></div>" + commentString;
				sendResponse({sendlist: commentString});
			});
		}
		// Post comment
		else if (request.requestlist.substring(0,11) === "postcomment") {
			inc = request.requestlist.split(',');
			var params = "oauth_token=" + localStorage.token + "&comment[body]=" + inc[1];
			if(view === "inc"){
				incData[2][current] = 0;
				id = incData[3][current];
			}
			else if (view === "fav"){
				favData[2][current] = 0;
				id = favData[3][current];
			}
			else{
				miscData[2][current] = 0;
				id = miscData[3][current];
			}
			xmlhttp = new XMLHttpRequest();
			xmlhttp.open("POST","https://api.soundcloud.com/tracks/" + id + "/comments.json",true); 
			xmlhttp.onreadystatechange=function () {
				if (xmlhttp.readyState===4) {
					sendResponse({sendlist: "posted"});
				}
			};
			xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			xmlhttp.send(params);
		}
		// Catch unrecognized requests
		else {
			sendResponse({});
		}
	}
);