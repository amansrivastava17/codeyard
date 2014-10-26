'use strict';

angular.module('mean.repos').factory('Repos', ['$http',
  function($http) {
  	var factory = {};
    
    factory.getUser = function(){
      return $http.get('/users/me');
    }

    factory.downloadRepo = function(reposlug){
      return $http.get('/repos/download/'+reposlug);
    }
    
    factory.createRepo = function(repo){
        return $http.post('/repos',repo);
    }
    
    factory.viewRepos = function(username){
    	return $http.get('/'+username+'/repos/view');
    }
    
    factory.getRepo = function(reposlug){
      return $http.get('/repos/'+reposlug);
    }

    factory.createFolder = function(folder){
      return $http.post('/repos/folder',folder);
    }

    factory.deleteRepo = function(reposlug){
      return $http.delete('/repos/'+reposlug);
    }
    return factory; 
  }
]);
