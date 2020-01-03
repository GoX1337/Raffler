let stream = false;
let raffle = false;

window.onload = () => {
	document.getElementById("streamButton").value = "Start tweets stream";

	setInterval(() => {
		fetch("/stats", {
			method: "GET"
		})
		.then(response => response.text())
		.then(response => {
			document.getElementById("count").innerHTML = response;
		})
		.catch(err => {
			console.log(err);
		});
	}, 3000);
}

let streamGet = (start) => {
	fetch(start ? "/stream/start" : "/stream/stop", {
		method: "GET"
	})
	.then(doc => {
	})
	.catch(err => {
		console.log(err);
	});
}

let raffleGet = (start) => {
	fetch(start ? "/raffle/start" : "/raffle/stop", {
		method: "GET"
	})
	.then(doc => {
	})
	.catch(err => {
		console.log(err);
	});
}

let streamButtonClick = () => {
	if (!stream) {
		document.getElementById("streamButton").value = "Stop tweets stream";
		stream = true;
	} else {
		document.getElementById("streamButton").value = "Start tweets stream";
		stream = false;
	}
	streamGet(stream);
}

let raffleButtonClick = () => {
	if (!raffle) {
		document.getElementById("raffleButton").value = "Stop raffle";
		raffle = true;
	} else {
		document.getElementById("raffleButton").value = "Start raffle";
		raffle = false;
	}
	raffleGet(raffle);
}