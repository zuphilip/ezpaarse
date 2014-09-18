'use strict';

/* Controllers of the admin page */

angular.module('ezPAARSE.admin-controllers', [])
  .controller('AdminCtrl', function ($scope, $http) {
    $scope.credentials = {};

    $scope.soft = {
      version: 'stable'
    };

    $scope.refreshStatus = function (what) {
      if (!what || what == 'platforms') {
        $scope.platformsStatus = 'refresh';
        $http.get('/platforms/status')
          .success(function (data) { $scope.platformsStatus = data.trim(); })
          .error(function ()       { $scope.platformsStatus = 'error'; });
      }

      if (!what || what == 'software') {
        $scope.softwareStatus = 'refresh';
        $http.get('/app/status?version=' + $scope.soft.version)
          .success(function (data) { $scope.softwareStatus = data.trim(); })
          .error(function ()       { $scope.softwareStatus = 'error'; });
      }
    };
    $scope.refreshStatus();

    $http.get('/users/')
      .success(function (users) { $scope.users = users; })
      .error(function () { $scope.getUsersError = true; });

    /**
     * Check every 5sec if the server is online
     */
    var checkOnline = function (callback) {
      setTimeout(function () {
        $http.get('/', { timeout: 5000 })
        .success(callback)
        .error(checkOnline);
      }, 5000);
    };

    $scope.updatePlatforms = function () {
      $scope.platformsStatus = 'refresh';
      $http.put('/platforms/status', 'uptodate')
        .success(function () { $scope.platformsStatus = 'uptodate'; })
        .error(function ()   { $scope.platformsStatus = 'error'; });
    };

    $scope.updateSoftWare = function () {
      $scope.softwareStatus = 'refresh';

      $http.put('/app/status?version=' + $scope.soft.version)
        .success(function () { checkOnline(function () { $scope.refreshStatus(); }); })
        .error(function () { $scope.softwareStatus = 'error'; });
    };

    $scope.deleteUser = function (userid) {
      $scope.postUserError = undefined;

      $http.delete('/users/' + userid)
        .success(function () {
          for (var i = $scope.users.length - 1; i>=0; i--) {
            if ($scope.users[i].username == userid) {
              $scope.users.splice(i, 1);
              break;
            }
          }
        })
        .error(function (data, status, headers) {
          var errorMessage    = headers('ezpaarse-status-message');
          $scope.postUserError = errorMessage || 'An error occured';
        });
    };

    $scope.createUser = function () {
      $scope.postUserError       = undefined;
      $scope.credentials.confirm = $scope.credentials.password;
      $http.post('/users/', $scope.credentials)
        .success(function (user) {
          $scope.users.push(user);
        })
        .error(function (data, status, headers) {
          var errorMessage     = headers('ezpaarse-status-message');
          $scope.postUserError = errorMessage || 'An error occured';
        });
    };

  });