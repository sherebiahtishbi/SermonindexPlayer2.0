/*
Author      : Sherebiah Tisbi
Datw Written: 04/27/2020
Goal        : script pertains to index.html
Change Log  : None
*/
const needle = require('needle');
const download = require('download');
const os = require('os');
const fs = require('fs');
const { ipcRenderer } = require('electron')
const logger = require('electron-log');



var speakerData, sermonData, speakerFolder, audio, audioDuration, playbar, media, currentMediaLocation;
var elemTrack, elemSpeakerSearch, elemSermonSearch, elemSermonStatus, elemSpeakerAlert, elemSpeakerTable, elemSermonTable, elemDownloadAllButton, elemPlayAlert, elemOpenFolderButton, elemCurrentPlayingCell; 
var sermonbasepath = os.homedir() + '/SermonIndex_Sermons/';
var playIcon = "<i class='fas fa-play'></i>";
var pauseIcon = "<i class='fas fa-pause'></i>";
var downloadIcon = "<i class='fas fa-download'></i>";
var spinnerIcon = "<i class='fas fa-cog fa-spin'></i>";
var folderIcon = "<i class='fas fa-folder-open'></i>";
var successIcon = "<i class='far fa-check-circle'></i>";
var failIcon = "<i class='far fa-exclamation-circle'></i>";
var speakerIcon = "<i class='fas fa-user'></i>";
var pdfIcon = "<i class='far fa-file-pdf'></i>";

$(document).ready(function () {
    //alert('I am ready to roll!');

    logger.info('GUI is initialized.');
    $("#divSermonStatus").hide();
    track = $("#mediaBar");

    var apiUrl = 'https://api.sermonindex.net/audio/speaker/_sermonindex.json';
    var options = {
        headers: {
            "Content-Type": "application/json"
        }
    }

    logger.info('Loadign speakers from sermonindex API.');
    $("#spanSpeakerAlert").html(spinnerIcon + ' Loading Speaker.');
    needle('get', apiUrl, options)
        .then(function (response) {
            logger.info('Speakers JSON received.');
            console.log(response);
            speakerData = response.body

            var speakertitle = "Speakers (" + Object.keys(response.body).length + ")";
            $('#divSpeakerlist').html(speakertitle);
            logger.info('Total speakers :' + Object.keys(response.body).length + ', now will populating them.');
            populateSpeakers('');
            $("#spanSpeakerAlert").html(successIcon + " " + Object.keys(response.body).length + ' speakers loaded.');
        })
        .catch(function (error) {
            console.log(error);
            logger.error('error fetching speakers from sermonindex.com. Error : ' + error);
            $("#spanSpeakerAlert").html(failIcon + " Error loading speakers.");
            alert('Error : could not fetch speakers data.');
        });
    $("#tblSpeakers").on('click', 'tr td', loadSermons);
    $("#tblSermons").on('click', 'tbody td:first-child', avOrIOaction);

    $(function () {
        $('[data-toggle="tooltip"]').tooltip()
    })
});

//handles download all button
$("#btnDownloadAll").click(function () { 
    logger.info('Download All button was pressed.');
    $("#divSermonStatus").show();
    console.log('Will download all sermons now!');
    var sermonsFromTable = $("#tblSermons tbody td:first-child");
    var url, sermonpath, sermonfilename, sermontitle;
    var downloadedSermons = 0;
    var totalSermons = sermonsFromTable.length;

    logger.info('Speaker data : ' + url);
    logger.info('Total sermons : ' + totalSermons);
    for (index = 0;index<totalSermons;index++) {
        url = sermonsFromTable[index].dataset['downloadurl'];
        sermonpath = sermonsFromTable[index].dataset['speakerfolder'];
        sermonfilename = sermonsFromTable[index].dataset['filename'];
        sermontitle = sermonsFromTable[index].dataset['sermontitle']; 

        logger.verbose('>Sermon : ' + url + '\\n>Speaker folder : ' + sermonpath + '\\nSermon filename : ' + sermonfilename + '\\nSermon title : ' + sermontitle);
        
        if (!fs.existsSync(sermonpath + sermonfilename)) {
            $("#spanPlayAlert").html(spinnerIcon + " downloading [ " + totalSermons + " ] sermons");
            sermonsFromTable[index].children[0].outerHTML = "<span class='sermon-downloading'>" + spinnerIcon + "</span>";
            downloadSermon(url, sermonpath, sermonfilename, index, sermontitle)
                .then((res) => {
                    sermonsFromTable[res.index].children[0].outerHTML = "<span class='sermon-available'>" + playIcon + "</span>";
                    // $("#spanPlayAlert").html(successIcon + " Completed downloading > " + sermontitle);
                    $("#spanPlayAlert").html(successIcon + " completed downloading [" + ++downloadedSermons + " of " + totalSermons + " ]");
                    console.log('Download complete...');
                    logger.info('Downloaded......' + sermonpath);
                })
                .catch((err) => {
                    // $("#spanPlayAlert").html(failIcon + " Failed downloading > " + sermontitle);
                    sermonsFromTable[err.index].children[0].outerHTML = "<span class='sermon-failed-download'>" + failIcon + "</span>";
                    console.log(err);
                    logger.error('Error downloading....' + sermonpath + '\\nError:' + err);
                });
        }
    }
});

//opens sermon folder
$("#btnOpenFolder").click(function () { 
    console.log("Will show speaker folder");
    logger.info('Openfolder utton clicked.');
    var options = {
        title: $('#divSermonlist').text(),
        defaultPath: (speakerFolder != undefined) ? speakerFolder : sermonbasepath
    }
    ipcRenderer.invoke('showdialog', options);
});

//downloads sermon if it doesnt exist locally or it starts playing sermon
function avOrIOaction(e) {
    var filepath = e.currentTarget.attributes['data-filepath'].value;
    var folderpath = e.currentTarget.attributes['data-speakerfolder'].value;
    var filename = e.currentTarget.attributes['data-filename'].value;
    var downloadUrl = e.currentTarget.attributes['data-downloadurl'].value;
    var sermonTitle = e.currentTarget.attributes['data-sermontitle'].value;
    console.log(filepath);
    logger.info('Audio player was clicked for ' + sermonTitle);
    if (fs.existsSync(filepath)) {
        console.log("Play : " + filepath);
        logger.info('sermon [' + sermonTitle +'] exists locallly.');
        if (filename.indexOf('mp3') < 0) {
            alert("This sermon is not in audio format, can't play!");
            logger.info('not an autio format.');
            return;
        } else {
            elemCurrentPlayingCell = e.currentTarget.children[0];
            if (media != undefined && !media.paused && media.src.replace('file://', '') == filepath) {
                media.pause();
                elemCurrentPlayingCell.innerHTML = playIcon;
                $('#btnStopMedia i').toggleClass('fa-play fa-pause');
            } else {
                logger.info('Now will play [' + filepath + ']');
                elemCurrentPlayingCell.innerHTML = pauseIcon;
                (media == undefined) ? playMedia(filepath, sermonTitle, 0) : media.play();
            }
        }
    } else {
        console.log("Download :" + filepath);
        logger.info('Sermon [' + sermonTitle + '] do not exist locally so will download.');
        $("#divSermonStatus").show();
        e.currentTarget.children[0].outerHTML = "<span class='sermon-downloading'>" + spinnerIcon + "</span>";
        $("#spanPlayAlert").html(spinnerIcon + " downloading [ " + sermonTitle + " ]");
        downloadSermon(downloadUrl, folderpath, filename, -1,sermonTitle)
            .then((res) => { 
                e.currentTarget.children[0].outerHTML = "<span class='sermon-available'>" + playIcon + "</span>";
                $("#spanPlayAlert").html(successIcon + " completed downloading [ " + sermonTitle + " ]");
                console.log('Download complete...');
                logger.info('Sermon ['+ sermonTitle +'] downloaded successfully');
            })
            .catch((err) => { 
                e.currentTarget.children[0].outerHTML = "<span class='sermon-failed-download'>" + failIcon + "</span>";
                console.log(err);
                logger.error('Error downloading [' + sermonTitle + ']\\nError : ' + err);
            });
    }
}

$('#btnStopMedia').click(() => {
    if (media != undefined) {
        (media.paused) ? media.play() : media.pause();
    } 
    var mediaButton = $('#btnStopMedia i');
    mediaButton.toggleClass('fa-play fa-pause');
    (mediaButton.attr('class') == 'fas fa-play') ? elemCurrentPlayingCell.innerHTML = playIcon : elemCurrentPlayingCell.innerHTML = pauseIcon;
});

function playMedia(sermonToPlay, sermontitle) {
    if (media != undefined) {
        media.pause();
    }
    media = new Audio(sermonToPlay);
    media.canPlayType('audio/mpeg');
    media.play()
    $('#btnStopMedia i').removeClass('fa-play').addClass('fa-pause');
    $('#btnStopMedia').removeAttr('disabled');
    $("#spanPlayAlert").text("Now Playing > " + sermontitle);
    logger.info('Started playing :' + sermontitle);

    media.addEventListener('play', (e) => { 
        console.log('Unpaused.');

    });

    //assign the media labels
    media.addEventListener('canplaythrough', (e) => { 
        audioDuration = e.currentTarget.duration;
        track.attr('max', audioDuration);
        $("#spanAudioTitle").text(sermontitle);
    });

    //update the slider on timeupdate
    media.addEventListener('timeupdate', (e) => { 
        var cTime = e.currentTarget.currentTime;
        track.val(cTime);
        $("#spanAudioStatus").text('[ ' + (cTime/60).toFixed(2) + ' / ' + (audioDuration/60).toFixed(2) + ' ]');
    });
}

//download promise
function downloadSermon(url,folderpath,filename, rowindex, title)
{
    logger.info('downloadSermon()->Entered.');
    var q = $.Deferred();
    var options = { filename: filename }
    var sermonsFromTable; 
    logger.info('downloadSermon()');   
    // $("#spanPlayAlert").html(spinnerIcon + " Started downloading > " + title);
    download(url, folderpath, options)
        .then((res) => {
            // $("#spanPlayAlert").html(successIcon + " Completed downloading > " + title);
            retObject = { downloaded: true, index: rowindex }
            logger.info('downloadSermon()-> Sermon downloaded successfully->' + filename);
            q.resolve(retObject);
        })
        .catch((err) => {
            $("#spanPlayAlert").html(failIcon + " Failed downloading > " + title);
            retObject = { downloaded: false, index: rowindex }
            logger.info('downloadSermon()-> error occurred downloading sermon->' + filename);
            q.reject(retObject);
        });    
    logger.info('downloadSermon()->Exited.');
    return q.promise();
}

//Handles the click event of a table cell from Speaker list
function loadSermons(e) {
    logger.info('loadSermons()->Entered.');
    $("#divSermonStatus").show();
    var speaker = e.currentTarget.attributes['data-speaker'].value;
    var speakerName = e.currentTarget.innerText;
    speakerFolder = sermonbasepath + speaker + "/";
    var apiUrl = 'https://api.sermonindex.net/audio/speaker/';
    apiUrl += speaker + '.json';
    var options = {
        follow_max: 5,
        headers: {
            "Content-Type":"application/json"
        }
    }
    console.log(apiUrl);
    logger.info('loadSermons()->Fetching sermons using sermonindex API for speaker >' + speakerName);
    $("#spanPlayAlert").html(spinnerIcon + " Loading Sermons of  > " + speakerName);
    $("#spanSpeakerAlert").html("<b>Selected :</b> [" + speakerName +"]");
    needle('get', apiUrl, options)
        .then(function (response) {
            console.log(response);
            sermonData = response.body.sermons;
            var sermonListTitle = "<h5>Sermons of " + speakerName + " (" + sermonData.length + ")</h5>";
            $('#divSermonlist').html(sermonListTitle);
            logger.info('loadSermons()->Sermons successfully fetched from sermoindex for speaker>' + speakerName);
            populateSermons('');
        })
        .catch(function (error) {
            alert('Error : could not fetch the data from sermnindex.net');
            console.log(error);
            logger.error('Error fetching sermons from sermonindex for : ' + speaker+'\\nError : '+ error);
        });
    logger.info('loadSermons()->Exited.');
}

//search speakers as user type in search box
$('#txtsearch').on('input', function () {
    var txt = $(this).val();
    logger.info('txtsearch>speakerSearch>input handler>applying search.');
    if (txt.length > 0) {
        populateSpeakers(txt);
    }
    else {
        populateSpeakers('');
    }
});

//search SERMONS as user type in search box
$('#txtsermonsearch').on('input', function () {
    var txt = $(this).val();
    logger.info('txtsermonsearch>sermonSearch>input handler>applying search.');
    if (txt.length > 0) {
        populateSermons(txt);
    }
    else {
        populateSermons('');
    }
});

//populate all speakers
function populateSpeakers(txt) {
    console.log('Rendering the speakers...');
    logger.info('populateSpeakers()->Entered.');

    var html = '';
    logger.info('populateSpeakers()->generating dynamic html for all speakers with search criteria>'+txt.length>0?txt:'no search criteria' );
    for (speaker in speakerData) {
        var spkname = formattedName(speaker);
        if (txt == '') {
            html += "<tr><td data-speaker='" + speaker + "'>" + spkname + "</td></tr>";
        } else {
            if (speaker.indexOf(txt) >= 0) {
                html += "<tr><td data-speaker='" + speaker + "'>" + spkname + "</td></tr>";
            }
        }
        logger.info('populateSpeakers()->html generated for speaker>'+spkname);
    }
    if (html == '') {
        html = "<tr><td>Sorry, No data!</td></tr>";    
        logger.info('populateSpeakers()->Sorry, No data!');
    } else {
        $("#tblSpeakers").html(html);
        logger.info('populateSpeakers()->dynamic html generated and popultated in GUI.');
    }
    logger.info('populateSpeakers()->exited.');
}

// populate sermons using regular HTML table istead of DataTable
function populateSermons(searchString) {
    logger.info('populateSermons()->Entered.');
    console.log("Rendering sermons...")
    var html = '';

    $("#btnDownloadAll").attr('disabled', 'disabled');
    
    if (sermonData.length == 0) {
        html = "<h3>No Data Available</h3>";
        logger.info('populateSermons()->No data to populate');
    } else {
        logger.info('populateSermons()->popuating sermons with search criteria>'+searchString);
        for (i = 0; i < sermonData.length; i++) {
            if (searchString == '') {
                html += formattedSermonRow(sermonData[i]);
            } else {
                if (sermonData[i].topic.toLowerCase().indexOf(searchString.toLowerCase()) >= 0 || sermonData[i].title.toLowerCase().indexOf(searchString.toLowerCase()) >= 0 || sermonData[i].format.toLowerCase().indexOf(searchString.toLowerCase()) >= 0) {
                    html += formattedSermonRow(sermonData[i]);
                }
            }
        }
        $("#tblSermons tbody").html(html);
        $("#spanPlayAlert").html(successIcon + " Sermons Loaded successfully!");
        logger.info('populateSermons()->sermons loaded in GUI.');
    }
    logger.info('populateSermons()->Exited.');
}

function formattedSermonRow(sermon)
{
    logger.info('formattedSermonRow()->Entered.');
    var ficon, duration;
    var sermontitle = removeQuotes(sermon.title);
    var sermonFilename = formattedSermontitle(sermontitle) + "." + sermon.format;
    var sermonFilepath = speakerFolder + sermonFilename;

    logger.info('formattedSermonRow()->started generating html for sermon>'+sermontitle);
    if (fs.existsSync(sermonFilepath)) {
        if (sermon.format == 'mp3') {
            ficon = "<span class='sermon-available' data-toggle='tooltip' data-placement='bottom' title='Click this icon listen to this sermon.'>" + playIcon + "</span>";
        } else {
            ficon = "<span class='sermon-nonaudio' data-toggle='tooltip' data-placement='bottom' title='Can't play this sermon.>" + pdfIcon + "</span>";
        }
        //duration = getMp3Duration(sermonFilepath);
    } else {
        ficon = "<span data-toggle='tooltip' data-placement='bottom' title='Click this icon to download this sermon.'>" + downloadIcon + "</span>";
        $("#btnDownloadAll").removeAttr('disabled');
    }

    var html = "";
    html += "<tr>";
    html += "<td class='text-center' data-sermontitle='" + sermontitle + "' data-downloadurl='" + sermon.download + "' data-filepath='" + sermonFilepath + "' data-speakerfolder='" + speakerFolder + "' data-filename='" + sermonFilename + "'>" + ficon + "</td>";
    html += "<td>" + sermon.topic + "</td>";
    html += "<td>" + sermontitle + "</td>";
    html += "<td>" + sermon.format + "</td>";
    html += "<td>0.00</td>";
    html += "</tr>";
    logger.info('formattedSermonRow()->completed generating html for>'+sermontitle);
    logger.info('formattedSermonRow()->Exited.');
    return html;
}

//removes all speacial characters and spaces from the sermon title
function formattedSermontitle(title) {
    logger.info('formattedSermontitle()->Entered.');
    var newtitle = title.replace(/\s/g, "_");
    newtitle = newtitle.replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '_');
    logger.info('formattedSermontitle()->title formatted successfully removing all special characters.\\nBefore>'+title+'\\nAfter>'+newtitle);
    logger.info('formattedSermontitle()->Exited.');
    return newtitle;
}

function removeQuotes(title) {
    logger.info('removeQuotes()->Entered.');
    var newtitle;
    var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    newtitle = title.replace(/[&<>"'`=\/]/g, function (s) {
        return entityMap[s];
    });
    logger.info('removeQuotes()->converetd problametic charcaters to html notations.\\nBefore>'+title+'\\nAfter>'+newtitle);
    logger.info('removeQuotes()->Exited.');
    return newtitle;
}

//format speaker name in porper case
function formattedName(name)
{
    logger.info('formattedName()->Entered.');
    var speakername = '', speakerarray;
    speakerarray = name.split('_');
    // speakerarray.array.forEach(element => {
    //     speakername = element.substr(0, 1).toUpperCase() + ' ';
    // });
    for (index = 0; index < speakerarray.length; index++) {
        speakername += speakerarray[index][0].toUpperCase() + speakerarray[index].slice(1) + ' ';
    } 
    logger.info('formattedName()->formatted speaker name.\\nBefore>'+name+'\\nAfter>'+speakername);
    logger.info('formattedName()->Exited.');
    return speakername;
}

/* Need to work on this further to get the audio duration before file is downloaded */
function getAudioDuration(audiofile) {
    var q = $.Deferred();
    var duration;

    var audioElement = $("divAudio");
    audioElement.src = audiofile;

    audioElement.on("canplaythrough", (e) => { 
        try {
            duration = e.currentTarget.duration;
            console.log(duration);
            q.resolve(duration);
        }
        catch{
            q.reject(-1);
        }
    });
    return q.promise();
}
