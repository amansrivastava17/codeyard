'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Repo = mongoose.model('Repo'),
  async = require('async'),
  config = require('meanio').loadConfig(),
  crypto = require('crypto'),
  nodemailer = require('nodemailer'),
  fs = require('fs'),
  fse = require('fs.extra'),
  makeslug = require('slug'),
  repoPath = config.repoPath;

exports.downloadRepo = function(req,res){
    var repoSlug = req.params.reposlug;
    var targz = require('tar.gz');
    /*var compress = new targz().compress(repoPath+repoSlug, repoPath+repoSlug+'.tar.gz', function(err){
            
        if(err){
            console.log(err);
            res.send();
        }else{*/
            var filePath = repoPath+'Calling.mp3';
            var stat = fs.statSync(filePath);
            console.log(filePath);
            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Length': stat.size
            });

            var readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        /*}
    });*/
};

var createSlug = function(type,repoName,callback){
	var max = 9999;
	var min = 1000;
	var newslug = makeslug(repoName).toLowerCase();
	if(type == 'repo'){
		Repo.find({slug:newslug},function(err,repo){
			if(err){
				console.log("Error");
				callback(null);
			}
			if(!repo){
				var num = Math.floor(Math.random() * (max - min + 1)) + min;
				newslug = newslug+'-'+num;
				callback(newslug);
			}
			else{
				callback(newslug);
			}
		});
	}
	else if(type == 'folder')
		callback(newslug); 
	else
		callback(null);
};


exports.createRepo = function(req,res){
	var repo = new Repo();
	var result = {};
	repo.name = req.body.reponame;
	repo.owner = req.user._id;
	repo.contributors.push(req.user._id);
	repo.ispublic = req.body.ispublic;
	repo.desc = req.body.desc;
	createSlug('repo',req.body.reponame, function(newslug){
		if(newslug){
		repo.slug = newslug;
		fs.mkdir(repoPath+repo.slug,function(err){
			if(err){
				console.log(err);
				res.send("There was an error while creating directory");
			}
			else{
				repo.save(function(error,response,numberAffected){
					if(error){
						console.log(error);
						result = {
							'error':1,
							'error_msg':'There was an error while saving repo'
						};
						res.jsonp(result);
					}
					else
					{
						User.findOneAndUpdate({_id:req.user._id},{$addToSet:{repos:{repo:response._id,isowner:true}}},function(err1,response1){
							if(err1){
								console.log(err1);
								result = {
								'error':1,
								'error_msg':'There was an error while saving repo'
								};
							}
							else{
								result = {
									'error':0,
									'error_msg': 'Repo made successfully'
								};
							}
							res.jsonp(result);
						});
					}
				});
			}
		});
	    }
	    else{
	    	res.send("There was an error while making the repo");
	    }
	});
};

exports.getRepo = function(req,res){
	var repoSlug = req.params.reposlug,
		result = {};
	Repo.findOne({slug:repoSlug},function(err,response){
		if(err){
			console.log(err);
			result = {
				'error':1,
				'error_msg':'There was an error while fetching repo info.'
			};
		}
		else{
			result = {
				'error':0,
				'error_msg':null,
				'repo':response
			};
		}
		res.jsonp(result);
	});
};

exports.viewAll = function(req,res){
	var username = req.params.username,
		result = {};
	User.find({username:username},{hashed_password:false,salt:false}).populate('repos.repo','slug _id desc ispublic updated').exec(function(err,response){
		if(err){
			console.log(err);
			result = {
				'error':1,
				'error_msg':'Error while looking for repos'
			};
		}
		else{
			result = {
				'error':0,
				'error_msg':'Repos found.',
				response:response
			};
		}
		res.jsonp(result);
	});
};


exports.deleteRepo = function(req,res){
	var owner = req.user._id,
		result = {},
		repoSlug = req.params.reposlug,
		repoid='';
		Repo.findOne({slug:repoSlug},function(err,response){
			if(err){
				console.log(err)
				result= {
					'error':1,
					'error_msg':'The repo could not be found in DB'
				};
				res.jsonp(result);
			}
			else if( response && response.owner.equals(owner)){
				repoid = response._id;
				fse.rmrf(repoPath+repoSlug,function(error){
					if(error){
						console.log(error);
						result = {
							'error' : 1,
							'error_msg': 'There was error while deleting the repo folder.'
						};
						res.jsonp(result);
					}
					else{
						Repo.remove({slug:repoSlug},function(Error){
							if(Error){
								console.log(Error);
								result = {
									'error' : 1,
									'error_msg': 'There was an error while deleting repo from DB.'
								};
								res.jsonp(result);
							}
							else{
								User.update({_id:owner},{$pull:{repos:{repo:repoid}}},function(err1,res1){
									if(err1){
										console.log(err1);
										result = {
											'error' : 1,
											'error_msg' : 'Error while removing repo from user'
										};
									}
									else{
										result = {
											'error':0,
											'error_msg':'Repo deleted successfully'
										};
									}
									res.jsonp(result);
								});
							}
						});
					}
				});
			}
			else{
				console.log(response);
				result = {
					'error': 1,
					'error_msg': 'You are not the owner of the repo.'
				};
				res.jsonp(result);
			}
		});
};

exports.update = function(req,res){
	var reposlug = req.params.reposlug,
		desc = req.body.desc,
		owner = req.user._id,
		result = {};

	Repo.findOne({slug: reposlug},function(err1,res1){
		if(err1){
			console.log(err);
			result = {
				'error':1,
				'error_msg':'Error while looking for repo.'
			};
			res.jsonp(result);
		}
		else if(res1 && (res1.contributors.indexOf(owner)!==-1)) {
				Repo.findOneAndUpdate({slug:reposlug},{updated:Date.now(),desc:desc},function(err,response){
					if(err){
						console.log(err)
						result = {
							'error':1,
							'error_msg':'Error while looking for repo.'
						};
					}
					else{
						result = {
							'error':0,
							'error_msg':'Repo description updated successfully.',
							'repo':response
						};
					}
					res.jsonp(result);
				});
		}
		else{
			result = {
				'error': 1,
				'error_msg': 'You are not the owner of the repo.'
			};
			res.jsonp(result);
		}
	});
};


exports.createFolder = function(req,res){
	var folderName = req.body.folderName,
		result = {},
		pathInRepo = req.body.path,  
		repoSlug = req.body.repoSlug;
		createSlug('folder',folderName,function(folderSlug){
			if(folderSlug){
				fs.mkdir(repoPath+pathInRepo+folderSlug,function(err,response){
					if(err){
						if(err.errno == 47){
							result = {
								'error':1,
								'error_msg':'Folder with this name already exists'
							};
						}
						else{
							console.log(err);
							result = {
								'error':1,
								'error_msg':'There was an error while creating the folder in the repo'+ folderName
							};
						}
						res.jsonp(result);
					}
					else{
						Repo.findOneAndUpdate({slug:repoSlug},{updated:Date.now(),$push:{files:{path:pathInRepo+folderSlug,name:folderName,tag:'folder',slug:folderSlug}}},function(error,response1){
							if(error){
								console.log(error);
								result = {
									'error':1,
									'error_msg':'Error while saving the sub folder to database.'
								};
							}
							else{
								result = {
									'error':0,
									'error_msg':'Folder created successfully',
									'response':folderSlug
								};
							}
							res.jsonp(result);
						});
					}
				});
			}
		});	
};

exports.uploadFile = function(req,res){
	var paths = [],
		files = [],
		repoSlug = req.body.repoSlug,
		result = {};
	Object.keys(req.files).forEach(function (key) {
        files.push(req.files[key]);
        });
	console.log(req.body.path);
	processFiles(files,req.body.path,repoSlug, function(err,response){
		if(err)
			console.log(err);
		res.jsonp(response);
	});

};

var processFiles = function(files,path,repoSlug,cb){
	var result = {},
		i = 0,
		extension = '',
		fileName = '',
		filePath = '';
	files.forEach(function(file){
		console.log(path[i]);
		console.log(i);
		fs.readFile(file.path,function(err,data){
				extension = file.extension;
			    fileName = file.originalname.replace('.'+extension,'');
				filePath = config.repoPath+path[i]+'/'+file.originalname;
			
			if(err){
				result = {
					'error': 1,
					'error_msg': 'Cannot read the file.'
				};
				console.log(err);
				//cb(err,result);
			}
			else{
				fs.writeFile(filePath,data,function(error,result){
					if(error){
						result = {
							'error':1,
							'error_msg':'Error while uploading the file.'
						};
						console.log(error);
						//cb(error,result);
					}
					else {
						Repo.findOneAndUpdate({slug:repoSlug},{updated:Date.now(),$push:{files:{path:path[i]+'/'+file.originalname, tag:extension, name:fileName}}},function(error1,response1){
							if(error1){
								result = {
									'error':1,
									'error_msg':'There was error while saving the file in DB.'
								};
								console.log(error1);
								//cb(error1,result);
							}				
							else
							 i=i+1;			
						});
					}
				});
			}
		});
	});
	result = {
				'error':0,
				'error_msg':'Files committed successfully'
			};
	cb(null,result);
};

exports.deleteFile = function(req,res){
	var fileId = req.body.fileId,
		filePath= req.body.filePath,
		result = {};
		fs.unlink(repoPath+filePath, function(err){
			if(err){
				console.log(err);
				result = {
					'error':1,
					'error_msg':'Unable to delete the file'
				};
				res.jsonp(result);
			}
			else{
				Repo.findOneAndUpdate({'files.path':filePath},{updated:Date.now(),$pull:{files:{path:filePath}}},function(error,response){
					if(error){
						console.log(error);
						result = {
							'error':1,
							'error_msg':'Unable to delete the file from the DB'
						};
					}
					else{
						result = {
							'error':0,
							'error_msg':'FIle deleted successfully'
						};
					}
					res.jsonp(result);
				});
			}
		});
};

exports.getFile = function(req,res){
	var filePath = req.params.filepath,
		result = {};

	fs.readFile(repoPath+filePath,"utf8",function(err,data){
		if(err){
			console.log(err);
			result = {
				'error':1,
				'error_msg':'Cannot find the required file'
			};
		}
		else{
			result = {
				'error':0,
				'error_msg':null,
				'data':data
			};
		}
		res.jsonp(result);
	});
};

exports.uploadRepo = function(req,res){
	console.log(req.body);
	console.log('*********************************');
	console.log(req.files.folder);
	//var r = fs.createReadStream('');
	//var w = fs.createWriteStream('file.txt.gz');
	//r.pipe(w);
};

exports.addCollab = function(req,res){
	var repoid = req.params.repoid,
		uid = req.body.uid,
		result = {};

	User.findOneAndUpdate({_id:uid},{$addToSet:{repos:{repo:repoid,isowner:false}}},function(err1,response1){
		if(err1){
			console.log(err1)
			result = {
				'error':1,
				'error_msg':'There was an error while adding collaborator'
			};
			res.jsonp(result);
		}
		else{
			Repo.findOneAndUpdate({_id:repoid},{updated:Date.now(),$addToSet:{contributors:uid}},function(err2,response2){
				if(err2){
					console.log(err2)
					result = {
						'error':1,
						'error_msg':'There was an error while adding collaborator'
					};
				}
				else{
					result = {
						'error':0,
						'error_msg':'collaborator successfully added'
					};
				}
				res.jsonp(result);
			});
		}
	});
};