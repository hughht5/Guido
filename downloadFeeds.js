var http = require('http');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var querystring = require('querystring');
var exec = require('child_process').exec;

console.log("About to download TechCrunch main feed.");
//download feed
http.get("http://feeds.feedburner.com/TechCrunch/", function(res) {
	console.log("Got response: " + res.statusCode);
	console.log('STATUS: ' + res.statusCode);
	console.log('HEADERS: ' + JSON.stringify(res.headers));
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

//parse xml, convert it to JSON, and extract blog feeds.
function parse(xml){
	parser.parseString(xml, function (err, result) {
		var posts = [];
		
		//for each post, collect the values and add it to the posts array
		for (var x=0;x<result.rss.channel[0].item.length;x++){
			var post = new Object();
			item = result.rss.channel[0].item[x];
			post.title = item.title[0];
			post.pubDate = item.pubDate[0];
			post.link = item.link[0];
			post.description = item.description[0];
			post.author = item['dc:creator'][0];
			post.content = item['content:encoded'][0];
			
			post.content = fixContent(post);
			
			posts.push(post);
		}
		//writeToFile("test0.html",posts[0].content);
		postToGlog(posts);
		postToBlogger(posts);
	});
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
	
	var complete = curr_date + "/"+curr_month+"/"+curr_year;
	
	//console.log(complete);
	return complete;
}

/*
 * Post an array of posts to Glog
 */
function postToGlog(posts){
	for (var x=0;x<posts.length;x++){
		//add JSON headers to post
		posts[x].title = posts[x].title.replace(/[:*?"<>|\/]+/g,'');
		posts[x].content = addJSONHeader(posts[x]);
		
		//write post to file
		writeToFile("articles/"+posts[x].title+".txt",posts[x].content); //regex removes filename special characters
		
		//execute git push
		exec('cd articles; git add "'+posts[x].title+'.txt"', function(error, stdout, stderr) { //; git commit -a -m "adding new article: '+posts[x].title+'"; git push
			if(error) {
				console.log('Could not commit and push new articles: ' + error);
			}
			console.log('Stdout: ' + stdout);
			console.log('Stderr: ' + stderr);
			
		});
		console.log(posts[x].title+".txt");
	}
}

/*
 * Add JSON header for Glog posts.
 */
function addJSONHeader(post){
	return '{\n"title" : "'+post.title+'",\n"date" : "'+formatTime(post.pubDate)+'",\n"author" : "'+post.author+'"\n}\n\n'+post.content;
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





