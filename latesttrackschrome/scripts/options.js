// Check if input is an integer
function input_int(input) {
	return !isNaN(input) && parseInt(input, 10) == input;
}

// Load option values from local storage
function loadOptions() {
	if (localStorage.token) {
		$("#token").val(localStorage.token);
		$("#limit").val(localStorage.limit);
		$("#interval").val(localStorage.interval);
		$("#comopt").val(localStorage.comopt);
		if (localStorage.autoplay === 1) {
			$("#autoplay").attr("checked", "checked");
		}
	}
}

// Save option values to local storage
function saveOptions() {
	var error = "Error:";
	var token = $("#token").val();
	var limit = $("#limit").val();
	var interval = $("#interval").val();
	var comopt = $("#comopt").val();
	if (token !== "") {
		localStorage.token = token;
	}
	else {
		error = error + " missing token,";
	}
	if (input_int(limit)) {
		if (parseInt(limit, 10) > 50 || parseInt(limit, 10) < 1) {
			error = error + " invalid track limit,";
		}
		else {
			localStorage.limit = limit;
		}	
	}
	else {
		error = error + " invalid track limit,";
	}
	if (input_int(interval)) {
		if (parseInt(interval, 10) < 1) {
			error = error + " invalid new track check time,";
		}
		else {
			localStorage.interval = interval;
		}
	}
	else {
		error = error + " invalid new track check time,";
	}
	if ($("#autoplay").attr("checked")) {
		localStorage.autoplay = 1;
	}
	else {
		localStorage.autoplay = 0;
	}
	if (input_int(comopt)) {
		if(parseInt(comopt, 10) < 1) {
			error = error + " invalid comments per track,";
		}
		else {
			localStorage.comopt = comopt;
		}	
	}
	else {
		error = error + " invalid comments per track,";
	}
	if (error === "Error:") {
		chrome.extension.sendRequest({requestlist: "update," + token + "," + limit + "," + interval});
		$("#message").html("<div id=\"saved\">Options saved.</div>");
	}
	else {
		$("#message").html("<div id=\"errors\">" + error.substring(0, error.length - 1) + ".</div>");
	}
}

// Load options (if available) on page load
$(function(){loadOptions();});