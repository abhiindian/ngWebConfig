(function () {
    var app = angular.module('ngWebConfig', []);    // Assign module configuration by setting $http header    

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push('httpRequestInterceptorFactory'); // pushing httpRequestInterceptorFactory factory function to configuration   
    });    //Assigning httpRequestInterceptorFactory to module factory as factory function    
    app.factory('httpRequestInterceptorFactory', httpRequestInterceptorFactory);    //function for setting $http header common for all $http header call  
    function httpRequestInterceptorFactory() {
        return {
            request: function (config) {
                config.headers['Accept'] = 'application/json;odata=verbose';  //for returning JSON object instead of XML response                
                return config;
            }
        };
    }
    var webConfiglistName = 'WebPart.Config';
    var webConfiglistNameListItemEntityTypeFullName = 'SP.Data.WebPartConfigListItem';

    app.directive('webConfig', webConfigDirective);
    webConfigDirective.$inject = ['$compile', 'webConfigFactory', '$timeout'];
    function webConfigDirective($compile, webConfigFactory, $timeout) {
        var directive = { restrict: 'A', link: link }; return directive;
        function link(scope, element, attrs) {
            scope.WebpartItemId = 0;
            scope.webpartChange = {};
            scope.webpartChange.webPartId = element.parents("div[webpartid]").attr("webpartid");
            scope.webpartChange.webPartProps = scope.webPartProps;
            scope.webpartChange.element = element;
            function generateHtml(webPartProps) {
                var main = '<table><tr><th>Name</th><th>Value</th></tr>';
                for (var property in webPartProps) {
                    var generatedHtml = '';
                    if (webPartProps.hasOwnProperty(property)) {
                        if (typeof webPartProps[property] == 'string' || typeof webPartProps[property] == 'number') {
                            generatedHtml = '<tr><td>' + property + '</td><td><input ng-model="webpartChange.webPartProps[\'' + property + '\']" type="text"/></td></tr>';
                        } else if (typeof webPartProps[property] == 'boolean') {
                            generatedHtml = '<tr><td>' + property + '</td><td><input ng-model="webpartChange.webPartProps[\'' + property + '\']" type="checkbox"/></td></tr>';
                        } else if (typeof webPartProps[property] == 'object') {
                            var newProperty = property + 'Selected';
                            generatedHtml = '<tr><td>' + property + '</td><td><select ng-model="webpartChange.webPartProps[\'' + newProperty + '\']">';
                            for (var i = 0; i < webPartProps[property].length; i++) {
                                generatedHtml += '<option value="' + webPartProps[property][i] + '">' + webPartProps[property][i] + '</option>';
                            }
                            generatedHtml += '</select></td></tr>';
                        }
                    }
                    main = main + generatedHtml
                }
                main = main + '</table>';
                return main;
            }
            var generatedHtml = generateHtml(scope.webpartChange.webPartProps);
            var html = '<style></style><div ng-show="showEditProp"><a href="#" ng-click="showEditProperties()">Edit Properties</a>' +
                '<div class="modal fade config-modal" id="' + scope.webpartChange.webPartId +
                '" role="dialog" data-keyboard="false" data-backdrop="static">' +
                '<div class="modal-dialog"><div class="modal-content"><div class="modal-header">' +
                '<button type="button" class="close" data-dismiss="modal">&times;</button>' +
                '<h4 class="modal-title" style="color: #fff">Edit Properties</h4>' +
                '</div>' + '<div class="modal-body" style="overflow: hidden;">' +
                '<div class="text-center">' + generatedHtml +
                '</div>' + '<div class="modal-footer">' +
                '<button type="button" class="btn btn-default" ng-click="saveMyProperties(webPartProps)">Save</button>' +
                '<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>' +
                '</div>' + '</div></div></div></div>' +
                '</div>';
            element.removeAttr('web-config');
            element.prepend(html);
            scope.showEditProp = false;
            webConfigFactory.getWebpartDetails(scope.webpartChange.webPartId).then(function (collection) {
                if (collection.length) {
                    $timeout(function () {
                        scope.webpartChange.webPartProps = angular.copy(JSON.parse(collection[0].Properties));
                        scope.WebpartItemId = collection[0].Id;
                        scope.$emit('getWebpartProperties', scope.webpartChange);
                        //scope.$apply();               
                    }, 0);
                } else {
                    var addItem = { // Creating data object for Individual Nomination for data upload          
                        __metadata: {
                            type: webConfiglistNameListItemEntityTypeFullName //Assign Metadata tag for 'Award Vote' List from ngConstants     
                        },
                        Title: scope.webpartChange.webPartId,
                        Properties: JSON.stringify(scope.webpartChange.webPartProps)
                    }
                    webConfigFactory.addWebPartDetails(addItem).then(function (result) {
                        scope.WebpartItemId = result.d.Id;
                        scope.$emit('getWebpartProperties', scope.webpartChange);
                    }, errorLog);
                }
            }, errorLog);
            if (document.forms[MSOWebPartPageFormName].MSOLayout_InDesignMode.value == "1") {
                scope.showEditProp = true;
            } else {
                scope.showEditProp = false;
            }
            scope.showEditProperties = function () {
                jQuery("#" + scope.webpartChange.webPartId).modal('show');
            }
            scope.saveMyProperties = function () {
                console.log(scope.webpartChange.webPartProps);
                var data = { // Creating data object for Individual Nomination for data upload    
                    __metadata: {
                        type: webConfiglistNameListItemEntityTypeFullName //Assign Metadata tag for 'Award Vote' List from ngConstants 
                    }, Title: scope.webpartChange.webPartId,
                    Properties: JSON.stringify(scope.webpartChange.webPartProps)
                }
                webConfigFactory.editWebpartDetails(data, scope.WebpartItemId).then(function () {
                    jQuery("#" + scope.webpartChange.webPartId).modal('hide');
                    scope.$emit('getWebpartProperties', scope.webpartChange);
                }, function (error) {
                    console.log(error);
                    jQuery("#" + scope.webpartChange.webPartId).modal('hide');
                });
            }
            $compile(element)(scope);
            function errorLog(error) {
                console.log(error);
            }
        }
    }
    app.factory('webConfigFactory', webConfigFactory);
    webConfigFactory.$inject = ['$q', '$http'];
    function webConfigFactory($q, $http) {
        $http.defaults.headers.post['Content-Type'] = 'application/json;odata=verbose';
        // setting post header for $http object for SharePoint REST Call      
        $http.defaults.headers.post["X-RequestDigest"] = GetRequestDigest(); //setting post header for $http object for SharePoint REST Call with REQUEST DIGEST ID   
        var factory = {
            getWebpartDetails: getWebpartDetails,
            GetRequestDigest: GetRequestDigest,
            addWebPartDetails: addWebPartDetails,
            editWebpartDetails: editWebpartDetails
        };
        return factory;
        function getWebpartDetails(webpartId) {
            var deferred = $q.defer();
            var url = _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + webConfiglistName + "')/items?$filter=Title eq '" + webpartId + "'";
            var header = {
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "content-type": "application/json; odata=verbose"
                }
            }
            $http.get(url, header).success(function (data) {
                deferred.resolve(data.d.results);
            }).error(function (error) {
                deferred.reject(error);
            });
            return deferred.promise;
        }
        function addWebPartDetails(data) {
            var deferred = $q.defer();
            GetRequestDigest().then(function (requestDigest) {
                $http.defaults.headers.post["X-RequestDigest"] = requestDigest;
                $http.post(_spPageContextInfo.siteAbsoluteUrl + "/_api/web/Lists/getbytitle('" + webConfiglistName + "')/items", data).success(function (data, status, headers, config) {
                    deferred.resolve(data);
                }).error(function (data, status, headers, config) {
                    deferred.reject(data);
                });
            }, function (data) {
                deferred.reject(data);
            });
            return deferred.promise;
        }
        function GetRequestDigest() {
            var deferred = $q.defer();
            var url = _spPageContextInfo.siteAbsoluteUrl + "/_api/ContextInfo";
            var header = {
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "content-type": "application/json; odata=verbose"
                }
            }
            $http.post(url, header).success(function (data) {
                deferred.resolve(data.d.GetContextWebInformation.FormDigestValue);
            }).error(function (error) {
                deferred.reject(error);
            });
            return deferred.promise;
        }
        function editWebpartDetails(data, Id) {
            var deferred = $q.defer();
            $http.defaults.headers.post["X-HTTP-Method"] = "PATCH";
            $http.defaults.headers.post["If-Match"] = "*";
            GetRequestDigest().then(function (requestDigest) {
                $http.defaults.headers.post["X-RequestDigest"] = requestDigest;
                $http.post(_spPageContextInfo.siteAbsoluteUrl + "/_api/web/Lists/getbytitle('" + webConfiglistName + "')/items(" + Id + ")", data).success(function (data, status, headers, config) {
                    delete $http.defaults.headers.post["X-HTTP-Method"];// remove from http header POST to avoid other REST call collapse      
                    delete $http.defaults.headers.post["If-Match"];// remove from http header POST to avoid other REST call collapse      
                    deferred.resolve(data);
                }).error(function (data, status, headers, config) {
                    delete $http.defaults.headers.post["X-HTTP-Method"];// remove from http header POST to avoid other REST call collapse   
                    delete $http.defaults.headers.post["If-Match"];// remove from http header POST to avoid other REST call collapse   
                    deferred.reject(data);
                });
            }, function (data) { deferred.reject(data); }); return deferred.promise;
        }
    }
})();
