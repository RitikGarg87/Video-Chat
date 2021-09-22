
var mapPeers = {};
var labelusername = document.querySelector('#label-username');
var usernameinput = document.querySelector('#username');
var btnjoin = document.querySelector('#btn-join');

var username;

var websocket;

function webSocketonmessage(event){
    var parseData = JSON.parse(event.data);
    var peerusername = parseData["peer"];
    var action = parseData["action"];
    if(username == peerusername){
        return;
    }
    var receiver_channel_name = parseData['message']['receiver_channel_name'];

    if(action=='new-peer'){
        createofferer(peerusername, receiver_channel_name);
        return;
    }
    if(action == 'new-offer'){
        var offer = parseData['message']['sdp'];

        createAnswer(offer, peerusername, receiver_channel_name);
        return;
    }
    if(action == 'new-answer'){
        var answer = parseData['message']['sdp'];

        var peer = mapPeers[peerusername][0];
        peer.setRemoteDescription(answer);
        return;
    }
}
btnjoin.addEventListener('click', () => {
    username = usernameinput.value;
    if(username == ''){
        return;
    }
    usernameinput.value = '';
    usernameinput.disabled = true;
    usernameinput.style.visibility = 'hidden';

    btnjoin.disabled = true;
    btnjoin.style.visibility = 'hidden';

    var labelusername = document.querySelector('#label-username');
    labelusername.innerHTML = username;

    var loc = window.location;
    var wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://';
    }

    var endpoint = wsStart + loc.host + loc.pathname;
    

    websocket = new WebSocket(endpoint);

    websocket.addEventListener('open',(e) => {
        console.log('connection opened');

        sendSignal('new-peer', {});

    });
    websocket.addEventListener('message', webSocketonmessage);
    websocket.addEventListener('close',(e) => {
        console.log("connection closed");
    });
    websocket.addEventListener('error',(e) => {
        console.log("error occured");
    });


})

var localstream = new MediaStream();

const constraints = {
    "video": true,
    "audio": true
};
const localvideo = document.querySelector("#local-video");

const btntoggleAudio = document.querySelector("#btn-toggle-audio");
const btntoggleVideo = document.querySelector("#btn-toggle-video");


var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localstream = stream;
        localvideo.srcObject = localstream;
        localvideo.muted = true;

        var audioTracks = stream.getAudioTracks();
        var videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btntoggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if(audioTracks[0].enabled){
                btntoggleAudio.innerHTML = 'Audio mute';
                return;
            }
            btntoggleAudio.innerHTML = 'Audio unmute'

        });
        btntoggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if(videoTracks[0].enabled){
                btntoggleVideo.innerHTML = 'video off';
                return;
            }
            btntoggleVideo.innerHTML = 'video on'

        });
    })
    .catch(error => {
        console.log("error", error);
    })


function sendSignal(action, message){
    
    var jsonstr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,

    });
    console.log(jsonstr,"sendsigna")
    websocket.send(jsonstr);
    
}

function createofferer(peerusername, receiver_channel_name){
    var peer = new RTCPeerConnection(null);

    addlocaltracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open',() => {
        console.log("connection oppened");

    });
    dc.addEventListener('message', dcOnMessage);
    var remotevideo = createvideo(peerusername);
    setOnTrack(peer, remotevideo);

    mapPeers[peerusername] = [peer, dc];
    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerusername];
            if(iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remotevideo);
        }

    });
    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('new ice candidate: ', JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal("new-offer", {
            'sdp' : peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });
    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log("local description set")
        });
}
function createAnswer(offer, peerusername, receiver_channel_name){
    var peer = new RTCPeerConnection(null);

    addlocaltracks(peer);
    var remotevideo = createvideo(peerusername);
    setOnTrack(peer, remotevideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open',() => {
            console.log("connection oppened");
    
        });
        peer.dc.addEventListener('message', dcOnMessage);
        mapPeers[peerusername] = [peer, peer.dc];
    });


    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;
        console.log(iceConnectionState)

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerusername];
            if(iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remotevideo);
        }

    });
    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('new ice candidate: ', JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal("new-answer", {
            'sdp' : peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });
    peer.setRemoteDescription(offer)
    .then(() => {
        console.log("remote description set succesfully", peerusername);

        return peer.createAnswer();

    })
    .then(a => {
        console.log("answer created")

        peer.setLocalDescription(a)
    })
}    

function addlocaltracks(peer){
    localstream.getTracks().forEach(track => {
        peer.addTrack(track, localstream);
    });
}
var messageList = document.querySelector('#message-list');
function dcOnMessage(event){
        var message = event.data;
        var li = document.createElement('li');
        li.appendChild(document.createTextNode(message));
        messageList.appendChild(li);
    }

function createvideo(peerusername){
    var videocontainer = document.querySelector("#video-container")
    var remotevideo = document.createElement('video');

    remotevideo.id = peerusername + '-video';
    remotevideo.autoplay = true;
    remotevideo.playsInline = true;

    var videowrapper = document.createElement('div');
    videocontainer.appendChild(videowrapper);
    videowrapper.appendChild(remotevideo);

    return remotevideo;

}

function setOnTrack(peer, remotevideo){
    var remotestream = new MediaStream();

    remotevideo.srcObject = remotestream;

    peer.addEventListener('track', async (event) => {
        remotestream.addTrack(event.track, remotestream);
    });

}

function removeVideo(video){    
    console.log("hiii video has removed")
    
    var videowrapper = video.parentNode;

    videowrapper.parentNode.removeChild(videowrapper);
}