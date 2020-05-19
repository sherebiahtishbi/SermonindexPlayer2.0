/*
Author      : Sherebiah Tisbi
Datw Written: 04/27/2020
Goal        : script pertains to index.html and caontains the code for almost entire app
Change Log  : 05/09/2020 - MP3 duration for each download call
*/
const needle = require('needle');
const download = require('download');
const os = require('os');
const fs = require('fs');
const { ipcRenderer } = require('electron')
const logger = require('electron-log');

var speakerData, topicData, sermonData, topicSemonsData, speakerFolder, audio, audioDuration, playbar, media, medialist, currentTrackIndex, mediaButton;
var currentMediaLocation, menuState, countDownload, countPlayable, currentTab, sermonSortCol, sermonSortorder, speakerSortorder;
// var elemTrack, elemSpeakerSearch, elemSermonSearch, elemSermonStatus, elemSpeakerAlert, elemSpeakerTable, elemSermonTable, elemDownloadAllButton, elemPlayAlert, elemOpenFolderButton, elemCurrentPlayingCell; 
var elemCurrentPlayingCell, elemMediaButton; 
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
var iconSortasc = "<i class='fas fa-sort-alpha-up'></i>";
var iconSortdes = "<i class='fas fa-sort-alpha-down-alt'></i>";
var iconTopic = "<i class='fas fa-file-alt'></i>"

$(document).ready(function () {
    //alert('I am ready to roll!');

    logger.info('GUI is initialized.');
    $("#divSermonStatus").hide();
    track = $("#mediaBar");
    mediaButton = $('#btnStopMedia');
    $("#menuBar").removeClass('openmenu').addClass('closemenu');
    menuState = false;
    $("#divFadebody").hide();
    $("#divAbout").hide();
    currentTab = "Speakers";
    sermonSortCol = "title";
    sermonSortorder = "asc";
    speakerSortorder = "asc";

    loadSpeakers();
    // loadTopics();

    $("#tblSpeakers").on('click', 'tr td', loadSermons);
    // $("#tblTopics").on('click', 'tr td', loadTopicSermons);

    $("#tblSermons").on('click', 'tbody td:first-child', avOrIOaction);
    $("#tblSermons").on('click', 'tbody td:nth-child(3)', showSermonDescription);

    $(function () {
        $('[data-toggle="tooltip"]').tooltip()
    })
    
    // $(document.body).tooltip({ selector: "[title]" });
});

/* All event handlers */

// handles the sermon table header click event for sorting 
$(".sortable").click((e) => { 
    var elem = e.currentTarget;

    $('span[class*="sort"]', elem.parentElement).removeClass().addClass('sortInactive');
 
    if (elem.innerText.toLowerCase().indexOf("topic") >= 0) sermonSortCol = 'topic';
    if (elem.innerText.toLowerCase().indexOf("title") >= 0) sermonSortCol = 'title';
    if (elem.innerText.toLowerCase().indexOf("format") >= 0) sermonSortCol = 'format';

    $('span', elem).removeClass('sortInactive').addClass('sortActive');
    
    if (sermonSortorder == 'asc') { 
        $('span', elem).html(iconSortdes);
        sermonSortorder = 'des';
    } else {
        $('span', elem).html(iconSortasc);
        sermonSortorder = 'asc';
    }

    var searchString = $('#txtsermonsearch').text();
    populateSermons(searchString, sermonData).then((res) => { renderSermonTable(res); })
        
    // (currentTab == 'Speakers')
    //     ? populateSermons(searchString, sermonData).then((res) => { renderSermonTable(res); })
    //     : populateSermons(searchString, topicSemonsData).then((res) => { renderSermonTable(res); });
});

// handles the verticle tab click
$("#ulCateory li").click((e) => { 
    
    var tmpTab = e.currentTarget.innerText.replace(/\s/g,'');
    if (currentTab == tmpTab) return;

    currentTab = e.currentTarget.innerText.replace(/\s/g, '');
    $('li[class*="cat"]').removeClass('catActive').addClass('catInactive');
    e.currentTarget.classList.add('catActive')
    e.currentTarget.classList.remove('catInactive');
    $('#txtsermonsearch').text('');
    $('#txtsearch').text('');
    switch (currentTab) {
        case "Speakers":
            loadSpeakers();
            break;
        case "Topics":
            loadTopics();
            break;
        case "Playlist":
            loadPlaylist();
        default:
    }
});

// handles playing all sermons of selected speaker
$("#btnPlayAll").click((e) => {
    if (media != undefined) { 
        if (media.paused) {
            media.play();
            e.currentTarget.innerHTML = pauseIcon;
            $('i', mediaButton).toggleClass('fa-play fa-pause');
            elemCurrentPlayingCell.innerHTML = pauseIcon;
            return;
        } else {
            media.pause();
            e.currentTarget.innerHTML = playIcon;
            elemCurrentPlayingCell.innerHTML = playIcon;
            $('i', mediaButton).toggleClass('fa-play fa-pause');
            return;
        }
    }
    medialist = [];
    var sermonsFromTable = $("#tblSermons tbody td:first-child");
    totalSermons = sermonsFromTable.length;
    for (index = 0; index < totalSermons; index++) {
        var tmpObj;

        url = sermonsFromTable[index].dataset['downloadurl'];
        sermonpath = sermonsFromTable[index].dataset['speakerfolder'];
        sermonfilename = sermonsFromTable[index].dataset['filename'];
        sermontitle = sermonsFromTable[index].dataset['sermontitle'];

        logger.verbose('>Sermon : ' + url + '\\n>Speaker folder : ' + sermonpath + '\\nSermon filename : ' + sermonfilename + '\\nSermon title : ' + sermontitle);

        if (fs.existsSync(sermonpath + sermonfilename)) { 
            tmpObj = {
                "filename": sermonpath + sermonfilename,
                "sermontitle": sermontitle,
                "domelement": sermonsFromTable[index].children[0]
            };

            medialist.push(tmpObj);
        }
    }
    if (medialist.length > 0) {
        e.currentTarget.innerHTML = pauseIcon;
        playMedia(medialist[0].filename, medialist[0].sermontitle);
        elemCurrentPlayingCell = medialist[0].domelement;
        currentTrackIndex = 0;
    }
});

$("#aAbout").click((e) => {
    $("#divAbout").show();
});

$("#btnCloseAbout").click((e) => {
    $("#divAbout").hide();
});

// handles opening/closing of left sliding menu bar
$("#menuPointer").click((e) => {
    menuState = !(menuState);
    $("#menuBar").toggleClass('openmenu closemenu');
    if (menuState) {
        $("#divFadebody").show();
        e.currentTarget.classList.add('menupointeropen');
        e.currentTarget.innerHTML = '<i class="fas fa-angle-left">';
    } else {
        $("#divFadebody").hide();
        e.currentTarget.classList.remove('menupointeropen');
        e.currentTarget.innerHTML = '<i class="fas fa-angle-right">';
    }
});

// handles download all button
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
    for (index = 0; index < totalSermons; index++) {
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
                    sermonsFromTable[res.index].children[0].outerHTML = "<span class='playable'>" + playIcon + "</span>";
                    if (countDownload > 0) {
                        --countDownload;
                        $("#btnDownloadAll").html(downloadIcon + " (" + countDownload + ")");
                    }
                    ++countPlayable;
                    getMp3Duration(sermonpath + sermonfilename, undefined)
                        .then((duration) => {
                            sermonsFromTable[res.index].parentElement.children[4].innerHTML = duration;
                            logger.info('MP3 duration calculated successfully for > ' + sermonfilename);
                        });
                    $("#spanPlayAlert").html(successIcon + " completed downloading [" + countPlayable + " of " + totalSermons + " ]");
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

// handles seeking the media position on media bar
$("#mediaBar").on('change', (e) => {
    console.log("User changed the media location to >" + e.currentTarget.value);
    if (media != undefined) media.currentTime = e.currentTarget.value;
});

// handles opening of sermon folder
$("#btnOpenFolder").click(function () {
    console.log("Will show speaker folder");
    logger.info('Openfolder utton clicked.');
    var options = {
        title: $('#divSermonlist').text(),
        defaultPath: (speakerFolder != undefined) ? speakerFolder : sermonbasepath
    }
    ipcRenderer.invoke('showdialog', options);
});

// handle toggling of play/pause button on media bar
$('#btnStopMedia').click(() => {
    if (media != undefined) {
        (media.paused) ? media.play() : media.pause();
    }
    $('i', mediaButton).toggleClass('fa-play fa-pause');
    ($('i', mediaButton).attr('class') == 'fas fa-play') ? elemCurrentPlayingCell.innerHTML = playIcon : elemCurrentPlayingCell.innerHTML = pauseIcon;
});

// handles filtering speaker/topic list as user type in search box
$('#txtsearch').on('input', function () {
    var txt = $(this).val();
    logger.info('txtsearch>speakerSearch>input handler>applying search.');
    if (txt.length > 0) {
        populateSpeakers(txt);
        populateTopics(txt);
    }
    else {
        populateSpeakers('');
        populateTopics('');
    }
});

// handles filtering sermons as user type in search box
$('#txtsermonsearch').on('input', function () {
    var txt = $(this).val();
    logger.info('txtsermonsearch>sermonSearch>input handler>applying search.');
    var searchString;
    (txt.length > 0) ? searchString = txt : searchString = '';
    populateSermons(searchString, sermonData)
        .then((res) => {
            // $("#tblSermons tbody").html(res);
            renderSermonTable(res);
            logger.info('Sermons poulated successfully!');
        })
        .catch(() => {
            logger.info('ERROR : error populating sermons!');
        });
});

/* All functions */

// opens the description on the click of sermon title
function showSermonDescription(e) {
    // alert(e.currentTarget.innerText);
    var elem = e.currentTarget;
    if (elem.children.length == 3) {
        $('#divSermondescription', this).toggleClass('hideSermonDescription showSermonDescription');
    }
}

// loads the topics list 
function loadTopics() {
    var apiUrl = 'https://api.sermonindex.net/audio/topic/_sermonindex.json';
    var options = {
        headers: {
            "Content-Type": "application/json"
        }
    }

    logger.info('Loadign Topics from sermonindex API.');
    $("#spanSpeakerAlert").html(spinnerIcon + ' Loading topics.');
    needle('get', apiUrl, options)
        .then(function (response) {
            logger.info('topic JSON received.');
            console.log(response);
            topicData = response.body

            var topictitle = iconTopic + " Topics (" + Object.keys(response.body).length + ")";
            $('#divSpeakerlist').html(topictitle);
            logger.info('Total topics :' + Object.keys(response.body).length + ', now will populating them.');
            populateTopics('');
            $("#spanSpeakerAlert").html(successIcon + " " + Object.keys(response.body).length + ' topics loaded.');
        })
        .catch(function (error) {
            console.log(error);
            logger.error('error fetching topics from sermonindex.com. Error : ' + error);
            $("#spanSpeakerAlert").html(failIcon + " Error loading topics.");
            alert('Error : could not fetch topic data.');
        });
}

//loads the speakers list
function loadSpeakers()
{
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

            var speakertitle = speakerIcon + " Speakers (" + Object.keys(response.body).length + ")";
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
}

// downloads sermon if it doesnt exist locally or it starts playing sermon
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
            if (elemCurrentPlayingCell != undefined) elemCurrentPlayingCell.innerHTML = playIcon;
            elemCurrentPlayingCell = e.currentTarget.children[0];
            if (media == undefined) {
                playMedia(filepath, sermonTitle, 0);
                logger.info('Now will play [' + filepath + ']');
                elemCurrentPlayingCell.innerHTML = pauseIcon;
                $('i', mediaButton).addClass('fa-pause').removeClass('fa-play');
            } else {
                if (media.paused) {
                    if (media.src.replace('file://','') == filepath) {
                        media.play();
                        logger.info('Unpaused [' + filepath + ']');
                        elemCurrentPlayingCell.innerHTML = pauseIcon;
                        $('i', mediaButton).addClass('fa-pause').removeClass('fa-play');
                    } else {
                        playMedia(filepath, sermonTitle, 0);
                        logger.info('Now will play [' + filepath + ']');
                        elemCurrentPlayingCell.innerHTML = pauseIcon;
                        $('i', mediaButton).addClass('fa-pause').removeClass('fa-play');
                    }
                } else {
                    if (media.src.replace('file://','') == filepath) {
                        media.pause();
                        logger.info('Paused [' + filepath + ']');
                        elemCurrentPlayingCell.innerHTML = playIcon;
                        $('i', mediaButton).addClass('fa-play').removeClass('fa-pause');
                    } else {
                        playMedia(filepath, sermonTitle, 0);
                        logger.info('Now will play [' + filepath + ']');
                        elemCurrentPlayingCell.innerHTML = pauseIcon;
                        $('i', mediaButton).addClass('fa-pause').removeClass('fa-play');
                    }                    
                }
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
                e.currentTarget.children[0].outerHTML = "<span class='playable'>" + playIcon + "</span>";
                $("#spanPlayAlert").html(successIcon + " completed downloading [ " + sermonTitle + " ]");
                if (countDownload > 0) {
                    --countDownload;
                    $("#btnDownloadAll").html(downloadIcon + " (" + countDownload + ")");
                }
                getMp3Duration(folderpath + filename, undefined)
                    .then((duration) => {
                        e.currentTarget.parentElement.children[4].innerHTML = duration;
                        logger.info('MP3 duration calculated successfully for > ' + filename);                        
                    });
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

// plays selected media
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
        $('#btnStopMedia i').innerHTML = pauseIcon;
        $('#btnP')
    });

    // check when audio finished playing 
    media.addEventListener('ended', (e) => { 
        elemCurrentPlayingCell.innerHTML = playIcon;
        if (currentTrackIndex < medialist.length - 1) {
            ++currentTrackIndex;
            elemCurrentPlayingCell = medialist[currentTrackIndex].domelement;
            playMedia(medialist[currentTrackIndex].filename, medialist[currentTrackIndex].sermontitle);
        }
        console.log('Audio finished playing.');
    });

    //assign the media labels
    media.addEventListener('canplaythrough', (e) => { 
        audioDuration = e.currentTarget.duration;
        track.attr('max', audioDuration);
        $("#spanAudioTitle").text(sermontitle);
        elemCurrentPlayingCell.innerHTML = pauseIcon;
    });

    //update the slider on timeupdate
    media.addEventListener('timeupdate', (e) => { 
        var cTime = e.currentTarget.currentTime;
        track.val(cTime);
        $("#spanAudioStatus").text('[ ' + (cTime / 60).toFixed(2) + ' / ' + (audioDuration / 60).toFixed(2) + ' ]');
    });
}

// downloads the sermon 
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

//loads the sermons for the speaker/topic from left list
function loadSermons(e) {
    logger.info('loadSermons()->Entered.');
    
    $("#divSermonStatus").show();
    var apiUrl;
    switch (currentTab) {
        case "Speakers":
            var speaker = e.currentTarget.attributes['data-speaker'].value;
            var speakerName = e.currentTarget.innerText;
            speakerFolder = sermonbasepath + speaker + "/";
            apiUrl = 'https://api.sermonindex.net/audio/speaker/' + speaker + ".json";
            console.log(apiUrl);
            logger.info('loadSermons()->Fetching sermons using sermonindex API for speaker >' + speakerName);
            $("#spanPlayAlert").html(spinnerIcon + " Loading Sermons of  > " + speakerName);
            $("#spanSpeakerAlert").html("<b>Selected :</b> [" + speakerName + "]");
            break;
        case "Topics":
            var topic = e.currentTarget.attributes['data-topic'].value;
            var topicName = e.currentTarget.innerText;
            var apiUrl = 'https://api.sermonindex.net/audio/topic/' + topic + '.json';
            console.log(apiUrl);
            logger.info('loadSermons()->Fetching sermons using sermonindex API for speaker >' + speakerName);
            $("#spanPlayAlert").html(spinnerIcon + " Loading Sermons on  > " + topicName);
            $("#spanSpeakerAlert").html("<b>Selected :</b> [" + topicName + "]");            break;
        case "Playlist":
            default:
     }
    var options = {
        follow_max: 5,
        headers: {
            "Content-Type":"application/json"
        }
    }
    needle('get', apiUrl, options)
        .then(function (response) {
            console.log(response);
            sermonData = response.body.sermons;
            var sermonListTitle = "<h5>Sermons of " + speakerName + " (" + sermonData.length + ")</h5>";
            $('#divSermonlist').html(sermonListTitle);
            logger.info('loadSermons()->Sermons successfully fetched from sermoindex for speaker>' + speakerName);
            populateSermons('',sermonData)
                .then((res) => {
                    renderSermonTable(res);
                })
                .catch(() => {
                    logger.log("ERROR: error populating sermons!");
                });
        })
        .catch(function (error) {
            alert('Error : could not fetch the data from sermnindex.net');
            console.log(error);
            logger.error('Error :  could not fetch the data from sermnindex.net > '+ error);
        });
    logger.info('loadSermons()->Exited.');
}

// renders the dynamic html prepared for all sermons of a sepected speaker/topic
function renderSermonTable(html) {
    $("#tblSermons tbody").html(html);
    logger.info('Sermons poulated successfully!');
    var sermonTable = $("#tblSermons tbody");
    $("#btnDownloadAll").html(downloadIcon + " (" + countDownload + ")");
    // $('[data-toggle="tooltip"]').tooltip();
    loadMp3Duration(sermonTable);    
}

// Fetchs mp3 durations 
function getMp3Duration(mediafile, elementToUpdate) {
    var q = $.Deferred();
    if (!fs.existsSync(mediafile)) { 
        q.reject("0.00");
    } else {
        var tmpMedia = new Audio(mediafile);
        tmpMedia.oncanplaythrough = (e) => {
            try {
                var tmpDuration = (tmpMedia.duration / 60).toFixed(2);
                if (elementToUpdate != undefined) elementToUpdate.innerHTML = tmpDuration;
                q.resolve(tmpDuration);
            }
            catch {
                q.reject("0.00");
            }
        }
    }
    return q.promise();
}

// wrapper around getMp3Duration for multiple MP3s
function loadMp3Duration(tablerows)
{
    var sermonRows = $('tr', tablerows);
    var filename, cellToupdate;
    for (i = 0; i < sermonRows.length; i++){
        filename = sermonRows[i].children[0].dataset['filepath'];
        cellToupdate = sermonRows[i].children[4];
        getMp3Duration(filename, cellToupdate)
            .then((res) => { 
                // cellToupdate.innerHTML(res);
            })
            .catch((err) => { 
                // cellToupdate.innerHTML("0.00");
            });
    }
}

// populates topic list
function populateTopics(txt) {
    console.log('Rendering the topics...');
    logger.info('populateTopics()->Entered.');

    var html = '';
    logger.info('populateTopics()->generating dynamic html for all topics with search criteria>' + txt.length > 0 ? txt : 'no search criteria');
    for (topic in topicData) {
        var tpkname = formattedName(topic);
        if (txt == '') {
            html += "<tr><td data-topic='" + topic + "'>" + tpkname + "</td></tr>";
        } else {
            if (tpkname.indexOf(txt) >= 0) {
                html += "<tr><td data-topic='" + topic + "'>" + tpkname + "</td></tr>";
            }
        }
        // logger.info('populateSpeakers()->html generated for speaker>'+spkname);
    }
    if (html == '') {
        html = "<tr><td>Sorry, No data!</td></tr>";
        logger.info('populateTopics()->Sorry, No data!');
    } else {
        $("#tblSpeakers").html(html);
        logger.info('populateTopics()->dynamic html generated and popultated in GUI.');
    }
    logger.info('populateTopics()->exited.');
}

// populates speakers list
function populateSpeakers(txt) {
    console.log('Rendering the speakers...');
    logger.info('populateSpeakers()->Entered.');

    var html = '';
    logger.info('populateSpeakers()->generating dynamic html for all speakers with search criteria>' + txt.length > 0 ? txt : 'no search criteria');

    for (speaker in speakerData) {
        var spkname = formattedName(speaker);
        if (txt == '') {
            html += "<tr><td data-speaker='" + speaker + "'>" + spkname + "</td></tr>";
        } else {
            if (speaker.indexOf(txt) >= 0) {
                html += "<tr><td data-speaker='" + speaker + "'>" + spkname + "</td></tr>";
            }
        }
        // logger.info('populateSpeakers()->html generated for speaker>'+spkname);
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

// prepares the dynamic html for sermons list
function populateSermons(searchString,data) {
    var q = $.Deferred();
    countPlayable = countDownload = 0;
    logger.info('populateSermons()->Entered.');
    console.log("Rendering sermons...")
    var html = '';

    data.sort((sermon1, sermon2) => { 
        switch (sermonSortCol) {
            case 'title':
                if (sermonSortorder == 'asc') {
                    return sermon1.title < sermon2.title ? -1 : 1;
                } else {
                    return sermon1.title < sermon2.title ? 1 : -1;
                }
                break;
            case 'format':
                if (sermonSortorder == 'asc') {
                    return sermon1.format < sermon2.format ? -1 : 1;
                } else {
                    return sermon1.format < sermon2.format ? 1 : -1;
                }
                break;
            case 'topic':
                if (sermonSortorder == 'asc') {
                    return sermon1.topic < sermon2.topic ? -1 : 1;
                } else {
                    return sermon1.topic < sermon2.topic ? 1 : -1;
                }
                break; 
            case 'speaker':
                if (sermonSortorder == 'asc') {
                    return sermon1.preacher_name < sermon2.preacher_name ? -1 : 1;
                } else {
                    return sermon1.preacher_name < sermon2.preacher_name ? 1 : -1;
                }
                break;            
            default:
                if (sermonSortorder == 'asc') {
                    return sermon1.title < sermon2.title ? 1 : -1;
                } else {
                    return sermon1.title < sermon2.title ? -1 : 1;
                }
        }
    });

    $("#btnDownloadAll").attr('disabled', 'disabled');
    try {
        if (data.length == 0) {
            html = "<h3>No Data Available</h3>";
            logger.info('populateSermons()->No data to populate');
            $("#spanPlayAlert").html(failIcon + " No sermons to load!");
        } else {
            logger.info('populateSermons()->popuating sermons with search criteria>' + searchString);
            for (i = 0; i < data.length; i++) {
                if (searchString == '') {

                    html += formattedSermonRow(data[i]);
                } else {
                    if (data[i].topic.toLowerCase().indexOf(searchString.toLowerCase()) >= 0 || data[i].title.toLowerCase().indexOf(searchString.toLowerCase()) >= 0 || data[i].format.toLowerCase().indexOf(searchString.toLowerCase()) >= 0) {
                        html += formattedSermonRow(data[i]);
                    }
                }
            }
            $("#spanPlayAlert").html(successIcon + " Sermons Loaded successfully!");
            logger.info('populateSermons()->sermons loaded in GUI.');
        }
        // $("#tblSermons tbody").html(html);
        q.resolve(html);
    }
    catch {
        q.reject(html);
    }
    logger.info('populateSermons()->Exited.');
    return q.promise();
}

// prepares dynamic html row for single sermon
function formattedSermonRow(sermon)
{
    // logger.info('formattedSermonRow()->Entered.');
    var ficon, duration, html;
    var sermontitle = removeQuotes(sermon.title);
    var sermonFilename = formattedSermontitle(sermontitle) + "." + sermon.format;
    var sermonFilepath;
    if (currentTab != 'Speakers') { 
        speakerFolder = getSpeakerFolder(sermon);
    }
    sermonFilepath = speakerFolder + sermonFilename;

    // logger.info('formattedSermonRow()->started generating html for sermon>' + sermontitle);
    
    if (fs.existsSync(sermonFilepath)) {
        if (sermon.format == 'mp3') {
            ficon = "<span class='playable' data-toggle='tooltip' data-placement='bottom' title='Play'>" + playIcon + "</span>";
            $("#btnPlayAll").removeAttr('disabled');
            ++countPlayable;
        } else {
            ficon = "<span class='sermon-nonaudio' data-toggle='tooltip' data-placement='bottom' title='This is not an audio format so can't play this sermon.>" + pdfIcon + "</span>";
        }
        //duration = getMp3Duration(sermonFilepath);
    } else {
        ficon = "<span data-toggle='tooltip' data-placement='bottom' title='Download'>" + downloadIcon + "</span>";
        // ficon = "<span data-toggle='tooltip' data-placement='bottom' title='Click this icon to download this sermon.'>" + downloadIcon + "</span>";
        $("#btnDownloadAll").removeAttr('disabled');
        ++countDownload;
    }
    var html = "";
    html += "<tr>";
    html += "<td class='text-center' data-sermontitle='" + sermontitle + "' data-downloadurl='" + sermon.download + "' data-filepath='" + sermonFilepath + "' data-speakerfolder='" + speakerFolder + "' data-filename='" + sermonFilename + "'>" + ficon + "</td>";
    if (currentTab == "Speakers") {
        html += "<td>" + sermon.topic + "</td>";
    } else {
        html += "<td>" + sermon.speaker_name + "</td>";
    }
    
    html += "<td id='cellSermonname'>" + detailedSermonTitle(sermon) + "</td>";
    // html += "<td data-toggle='tooltip' data-placement='right' title='" + sermon.description.replace(/'s/g, '&apos;') + "'>" + detailedSermonTitle(sermon) + "</td>";
    html += "<td>" + sermon.format + "</td>";
    html += "<td>0.00</td>";
    html += "</tr>";
    // logger.info('formattedSermonRow()->completed generating html for > ' + sermontitle);
    // logger.info('formattedSermonRow()->Exited.');
    return html;
}

// prepares dynamic html for sermotitle column with scripture and description
function detailedSermonTitle(sermon) {
    if (sermon.scripture.length == 0) return sermon.title;
    var retTitle = '';
    retTitle = "<div class='sermontitle'>" + sermon.title + "</div>";
    retTitle += "<div class='scripturelist'>" + sermon.scripture.replace(/'s/g, '&apos;') + "</div>";
    retTitle += "<div id='divSermondescription' class='hideSermonDescription'>" + sermon.description.replace(/'s/g, '&apos;') +"</div>";
    return retTitle;
}

// prepares speakerolder in case hwere sermons are listed for a topic
function getSpeakerFolder(topic) {
    var spkcode;

    spkcode = topic.speaker_name.replace(/\s\s/g, ' ').toLowerCase();
    spkcode = spkcode.replace(/[.]/g, "");
    spkcode = spkcode.replace(/\s/g, '_');

    spkcode = sermonbasepath + spkcode + "/";
    return spkcode;
}

// helper function to cleanup the string from special characters
function formattedSermontitle(title) {
    // logger.info('formattedSermontitle()->Entered.');
    var newtitle = title.replace(/\s/g, "_");
    newtitle = newtitle.replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '_');
    // logger.info('formattedSermontitle()->title formatted successfully removing all special characters.\\nBefore>'+title+'\\nAfter>'+newtitle);
    // logger.info('formattedSermontitle()->Exited.');
    return newtitle;
}

// rhelper function to remove characters which can mess up html
function removeQuotes(title) {
    // logger.info('removeQuotes()->Entered.');
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
    // logger.info('removeQuotes()->converetd problametic charcaters to html notations.\\nBefore>'+title+'\\nAfter>'+newtitle);
    // logger.info('removeQuotes()->Exited.');
    return newtitle;
}

//format speaker name in proper case
function formattedName(name)
{
    // logger.info('formattedName()->Entered.');
    var speakername = '', speakerarray;
    speakerarray = name.split('_');
    for (index = 0; index < speakerarray.length; index++) {
        speakername += speakerarray[index][0].toUpperCase() + speakerarray[index].slice(1) + ' ';
    } 
    // logger.info('formattedName()->formatted speaker name.\\nBefore>'+name+'\\nAfter>'+speakername);
    // logger.info('formattedName()->Exited.');
    return speakername;
}