var http = require('http');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var querystring = require('querystring');
var exec = require('child_process').exec;
var OAuth= require('oauth').OAuth;

//to ensure tweets are not repeated keep an array of posts and after the first loop start tweeting
var oldPosts = [];
var firstDownload = true;

//function to return what is in array 1 that is not in array 2 (this is a single directional diff)
Array.prototype.diff = function(a) {
    return this.filter(function(i) {return !(a.indexOf(i) > -1);});
};

//download feeds every 30 seconds
downloadFeeds();
setInterval(function(){
	firstDownload = false
	downloadFeeds();
},30000);

//download feed
function downloadFeeds(first){

	console.log("Updating TechCrunch main feed.");

	var options = {
	  host: 'feeds.feedburner.com',
	  port: 80,
	  path: '/TechCrunch',
	  method: 'GET'
	};

	http.get(options, function(res) {
		console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		var pageData = "";
		res.on('data', function (chunk) {
			pageData += chunk;
		});
		
		res.on('end', function(){
			parse(pageData);
		});

	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});

}

//parse xml, convert it to JSON, and extract blog feeds.
function parse(xml){
	parser.parseString(xml, function (err, result) {
		var posts = [];
		
		//for each post, collect the values and add it to the posts array
		for (var x=0;x<result.rss.channel[0].item.length;x++){
			var post = new Object();
			var item = result.rss.channel[0].item[x];
			post.title = item.title[0];
			post.pubDate = item.pubDate[0];
			post.link = item.link[0];
			post.description = item.description[0];
			post.author = item['dc:creator'][0];
			post.content = item['content:encoded'][0];
			
			post.content = fixContent(post);
			
			posts.push(post);
		}
		
		//remove posts that have already been downloaded into the oldPosts array
		var newPosts = postDiff(posts, oldPosts);
		
		//add newly posted posts to oldPosts array
		oldPosts = oldPosts.concat(newPosts);
	
		//post to blog
		postToGlog(newPosts);
		//postToBlogger(posts);
		
		//tweet
		if (!firstDownload){
			tweet(newPosts);
		}
		
	});
}

//function returns the posts that are in array a, but not also in array b
//function compares titles only.
function postDiff(a,b){
	// console.log("1 posts length - "+a.length);
	// console.log("1 olds posts length - "+b.length);
	
	
	var results = [];
	
	for (var i=0;i<a.length;i++){
	
		var found = false;
		
		for (var j=0;j<b.length;j++){
			if(a[i].title==b[j].title){
				found = true;
			}
		}
		
		// console.log("found "+i+ " = "+found);
		
		if (found == false){
			results.push(a[i]);
		}
		
	}
	
	console.log("Found "+results.length+" new posts.");
	
	return results;
}


//write result to file
function writeToFile(filename, string){
	fs.writeFile(filename, string, function(err) {
		if(err) {
			console.log(err);
		} else {
			//console.log("The file was saved!");
		}
	});
}

//function to remove all the comments links and adverts... from the bottom of each post
//also adds a reference link back to the original page on techcrunch or elsewhere
function fixContent(post){
	var fixed = "";
	fixed += post.content.substring(0,post.content.lastIndexOf('<br />'));
	fixed += '<br /> The original article was posted <a href="'+post.link+'">here</a>.';
	return fixed;
}


function formatTime(date){
	var d = new Date(date);
	var curr_date = d.getDate();
	if(curr_date.toString().length == 1){
		curr_date = "0"+curr_date;
	}
    var curr_month = d.getMonth() + 1; //Months are zero based
	if(curr_month.toString().length == 1){
		curr_month = "0"+curr_month;
	}
    var curr_year = d.getFullYear();
	
	var complete = curr_month+"/"+curr_date + "/"+curr_year;
	
	//console.log(complete);
	return complete;
}

/*
 * Post an array of posts to Glog
 */
function postToGlog(posts){
	var waiting = 0;
	for (var x=0;x<posts.length;x++){
		waiting++;
		
		//add JSON headers to post
		posts[x].content = addJSONHeader(posts[x]);
		
		//remove specials for url and filename
		var title = posts[x].title.replace(/[^a-zA-Z0-9]+/g,'');
		
		//write post to file - prepending current unix timestamp to ensure posts are in chronological order
		var time = (new Date(posts[x].pubDate)).getTime();
		fs.writeFile("articles/"+time+"_"+title+".txt", posts[x].content, function(err) {
			if(err) {
				console.log(err);
			} else {
				console.log("written article to disk.");
			}
			waiting--;
			complete();
		});
	}
	
	
	//execute git push
	function complete(){
		if (!waiting) {
			console.log("Scraping complete. Now commiting to GitHub");
			exec('git add *; git commit -a -m "adding new article"; git push', function(error, stdout, stderr) {
				if(error) {
					console.log('Could not commit and push new articles: ' + error);
				}
				console.log('Git - Stdout: ' + stdout);
				console.log('Git - Stderr: ' + stderr);
				
			});
		}
	}
}

/*
 * Add JSON header for Glog posts.
 */
function addJSONHeader(post){
	return '{\n"title" : "'+post.title+'",\n"date" : "'+post.pubDate+'",\n"author" : "'+post.author+'"\n}\n\n'+post.content;
}

function postToBlogger(posts){

	  // Build the post string from an object
	  // var post_data = querystring.stringify({
			// "kind": "blogger#post",
			// "blog": {
				// "id": "8070105920543249955"
			// },
			// "title": "A new post",
			// "content": "With <b>exciting</b> content..."
	  // });

	  // var post_options = {
		  // host: 'https://www.googleapis.com/blogger/v3/blogs/4222963732339919051/posts?key=AIzaSyCBcdHfmZGkitDPgs8AMdoPE1iygTUUM2s',
		  // port: '80',
		  // path: '',
		  // method: 'POST',
		  // headers: {
			  // 'Content-Type': 'application/json'
		  // }
	  // };

	  // var post_req = http.request(post_options, function(res) {
		  // res.setEncoding('utf-8');
		  // res.on('data', function (chunk) {
			  // console.log('Response: ' + chunk);
		  // });
	  // });
	  

	  // post_req.write(post_data);
	  // post_req.end();
	
}

function tweet(posts){
	
	//Authenticate with twitter
	oAuth= new OAuth(
		"http://twitter.com/oauth/request_token",
		"http://twitter.com/oauth/access_token", 
		"vGcpKRpAnL2E1UqYVbFLaQ", "wGBbbPpM2cSUigOX5XFwJkrg4Uh9pYYhXPeTxavV1v8", 
		"1.0A", null, "HMAC-SHA1"
	);

	//tweet all posts
	for (var x =0; x < posts.length; x++){
	
		var tweetText = posts[x].title;
	
		var tweetURL = getURL(posts[x]);
		
		//console.log("pretending to tweet : " + tweetURL + " " + tweetText)
		
		oAuth.post(
			"http://api.twitter.com/1/statuses/update.json",
			"144130100-EQ0fYvVigLUDO8oge1CIoYN05fvS0KTHiWO1KM3b", "9JIfZPLc6JhfJy9OGVcCHc2z4P7EuXhUypsBGNtw0",
			{"status":tweetURL + " " + tweetText},
			function(error, data) {
				if(error) console.log(require('sys').inspect(error))
				else console.log("tweeted : "+tweetURL + " " + tweetText);//console.log(data)
			}
		);
		
	}
}


//returns URL to post
function getURL(post){
	var date = new Date(post.pubDate);
	var year = date.getFullYear();
	var month = ('0'+(date.getMonth()+1)).slice(-2);
	var result = "http://www.techcrunchlite.com/"+[year, month, encodeURI(post.title.replace(/\s/g, '-'))].join('/');
	
	return result;
}

