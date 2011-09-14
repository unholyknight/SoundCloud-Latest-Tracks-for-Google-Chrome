/*************************************************************
	Background.js
	- contains html5 audio
	- trackData contains
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
var tNew = 0, fNew = 0, fIn = 0; autoplay = 0, comments = 0, view = "inc", viewlength = 0, extrafav = 0;
var trackData = [[], [], [], []];
var favData = [[], [], [], []];
var token, limit, interval, intTimer, buffered, buffTimer, current, linkcount, inc;

// Connect to SoundCloud, setup for latest track fetching
function initialize(fetch, inToken, inLimit, inInterval) {
	var i = 0;
	if (inToken != undefined) {
		token = inToken;
		limit = inLimit;
		interval = inInterval;
		SC.initialize({
			client_id: "2b161e5544f1f7f4cab5ff3c76c6c7b8",
			access_token: token
		});
		intTimer = setInterval(fetchTracks, 60 * interval * 1000);
		if (fetch === 1) {
			for (i = 0; i < trackData.length; i++) {
				trackData[i].length = 0;
			}
			for (i = 0; i < favData.length; i++) {
				favData[i].length = 0;
			}
			fetchTracks(0);
		}
	}
	else {
		clearInterval(intTimer);
	}	
}

// Initialize extension on load
initialize(0, localStorage.token, localStorage.limit, localStorage.interval);

// Fetch latest tracks from SoundCloud and notify user of new tracks
function fetchTracks(notify, more) {
	if (notify === null) { notify = 1; }
	if (more !== 1) {
		SC.get("/me/activities/tracks/affiliated?limit=" + limit, function (activities) {
			$.each(activities.collection, function () {
				var track = this.origin;
				if (track.title !== undefined) {
					var trackString = formatTrack(track.title, track.user.username, track.waveform_url,
										track.permalink_url, track.artwork_url, track.download_url,
										track.purchase_url, track.genre, track.commentable);
					if ($.inArray(trackString,trackData[0]) < 0 && $.inArray(track.id,trackData[3]) < 0) {
						if (notify === 0) {
							trackData[0].push(trackString);
							trackData[1].push(track.stream_url);
							trackData[2].push(track.user_favorite);
							trackData[3].push(track.id);
						}
						else {
							tNew++;
							trackData[0].unshift(trackString);
							trackData[1].unshift(track.stream_url);
							trackData[2].unshift(track.user_favorite);
							trackData[3].unshift(track.id);
						}
					}
				}
			});
			if (tNew > 0) {
				chrome.browserAction.setBadgeText({text: tNew + ""});
				if (view === "inc") {
					viewlength = trackData[0].length;
					current = inBounds((parseInt(current) + parseInt(tNew)), viewlength);
				}
				chrome.extension.sendRequest({requestlist: "new"});
			}
			if (notify === 0) {
				viewlength = trackData[0].length;
				trackPlayback(0, view);
			}
		});
	}
	if (more === 1) { extrafav++; offset = extrafav * limit + fIn; }
	else { offset = 0; }
	SC.get("/me/favorites?order=favorited_at&limit=" + limit + "&offset=" + offset, function (activities) {
		$.each(activities, function () {
			if (this.title !== undefined) {
				var trackString = formatTrack(this.title, this.user.username, this.waveform_url,
									this.permalink_url, this.artwork_url, this.download_url,
									this.purchase_url, this.genre, this.commentable);
				if ($.inArray(trackString,favData[0]) < 0 && $.inArray(this.id,favData[3]) < 0) {
					if (notify === 0) {
						favData[0].push(trackString);
						favData[1].push(this.stream_url);
						favData[2].push(this.user_favorite);
						favData[3].push(this.id);
					}
					else {
						fNew++;
						fIn++;
						favData[0].unshift(trackString);
						favData[1].unshift(this.stream_url);
						favData[2].unshift(this.user_favorite);
						favData[3].unshift(this.id);
					}
				}
			}
		});
		if (view === "fav") {
			viewlength = favData[0].length;
		}
		if (fNew > 0) {
			if (view === "fav") {
				current = inBounds((parseInt(current, 10) + parseInt(fNew, 10)), viewlength);
			}
			chrome.extension.sendRequest({requestlist: "new"});
		}
		if (more === 1) { chrome.extension.sendRequest({requestlist: "readymorefavs"}); }
	});
}

// Format fetched track for display
function formatTrack(title, artist, waveform, link, badge, dl, buy, genre, comment) {
	var formatted = "<a href=\"#\" class=\"tLink\" id=\"" + waveform + "," + link + "," + badge + "," + dl + "," + buy + "," + genre + "," + comment + "\">" + title + " by " + artist + "</a>";
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
		assocData = trackData[1][pos]; 
		view = "inc";
	}
	else { 
		assocData = favData[1][pos]; 
		view = "fav";
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
	if (track === "next") {
		track = parseInt(current) + 1;
	}
	if (localStorage.autoplay === "1" && track < viewlength) {
		current = inBounds(parseInt(track), viewlength);
		chrome.extension.sendRequest({requestlist: "next," + track});
		trackPlayback(track, view, 1);
	}
}

// Run initial track fetch (if extension is setup) on extension load
$(function () {
	if (token !== undefined) {
		fetchTracks(0);
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
					tNew = 0;
					chrome.browserAction.setBadgeText({text:""});
					sendResponse({sendlist: trackData[0]});
				}
				else {
					fNew = 0;
					sendResponse({sendlist: favData[0]});
				}
			}
			else if (inc[1] === "inc") {
				tNew = 0;
				chrome.browserAction.setBadgeText({text:""});
				sendResponse({sendlist: trackData[0]});
			}
			else {
				fNew = 0;
				sendResponse({sendlist: favData[0]});
			}
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
				viewlength = trackData[0].length;
			}
			else {
				viewlength = favData[0].length;
			}
			current = inBounds(parseInt(inc[2], 10), viewlength);
			trackPlayback(parseInt(inc[2], 10), inc[1], 1);
			sendResponse({});
		}
		// Send current playing track data string when requested
		else if (request.requestlist === "datastring") {
			if (view === "inc") {
				sendResponse({sendlist: trackData[0][current]});
			}
			else {
				sendResponse({sendlist: favData[0][current]});
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
				sendResponse({sendlist: trackData[2][current]});
			}
			else {
				sendResponse({sendlist: favData[2][current]});
			}
		}
		// Load more favorite tracks
		else if (request.requestlist === "loadmorefavs") {
			fetchTracks(0, 1);
		}
		// Save current track as favorite
		else if (request.requestlist === "saveFavorite") {
			trackData[2][current] = true;
			xmlhttp = new XMLHttpRequest(); 
			xmlhttp.open("PUT","https://api.soundcloud.com/me/favorites/" + trackData[3][current] + ".json?oauth_token=" + localStorage.token, true); 
			xmlhttp.send(null);
			sendResponse({});
		}
		// Remove current track from favorites
		else if (request.requestlist === "removeFavorite") {
			trackData[2][current] = false;
			xmlhttp = new XMLHttpRequest(); 
			xmlhttp.open("DELETE","https://api.soundcloud.com/me/favorites/" + trackData[3][current] + ".json?oauth_token=" + localStorage.token, true);
			xmlhttp.send(null);
			sendResponse({});
		}
		// Send the comments for the current track when requested
		else if (request.requestlist === "comments") {
			var i, trackComment = trackData[3][current];
			var commentString = "";
			var comopt = localStorage.comopt;
			if (comopt === undefined) { comopt = 20; }
			if (view === "fav") { trackComment = favData[3][current]; }
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
			xmlhttp = new XMLHttpRequest();
			xmlhttp.open("POST","https://api.soundcloud.com/tracks/" + trackData[3][current] + "/comments.json",true); 
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