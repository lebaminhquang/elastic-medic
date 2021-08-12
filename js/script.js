window.mainApp = angular.module('mainApp', ['elasticsearch'],
    ['$locationProvider', function($locationProvider){
        $locationProvider.html5Mode(true);
    }]
);

mainApp.factory('mainAppService',
    ['$q', 'esFactory', '$location', function($q, elasticsearch, $location){
        var client = elasticsearch({
            host: $location.host() + ":9200"
        });

        var search1 = function(term, offset){
            var deferred = $q.defer();
            var query = {
                "match": {
                    "drug": term
                }
            };

            client.search({
                "index": 'mimicdemo2',
                "type": 'prescriptions',
                "body": {
                    "size": 10,
                    "from": (offset || 0) * 10,
                    "query": query
                }
            }).then(function(result) {
                var ii = 0, hits_in, hits_out = [];
                hits_in = (result.hits || {}).hits || [];
                for(;ii < hits_in.length; ii++){
                    hits_out.push(hits_in[ii]._source);
                }
                deferred.resolve(hits_out);
            }, deferred.reject);

            return deferred.promise;
        };

        var search2 = function(search_term, offset, gender){
            var deferred = $q.defer();

            var query_gender = "";
            if (gender > 0) {
                query_gender = "M";
                if (gender > 1) {
                    query_gender = "F";
                }
            }

            


            var filter = [];
            var term = {};
            term.subject_id = search_term;
            filter.push({
                "terms":term
            });

            var must = [];
            var match = {};
            if (query_gender.length > 0) {
                match = {};
                match.gender = query_gender;
                must.push({
                    "match":match
                });
            }

            var query = {
                "bool": {
                    "must": must,
                    "filter":filter
                }
                
            };
            console.log('query: ' + JSON.stringify(query));

            client.search({
                "index": 'mimic_patients',
                "type": 'patient',
                "body": {
                    "size": 10,
                    "from": (offset || 0) * 10,
                    "query": query
                }
            }).then(function(result) {
                var ii = 0, hits_in, hits_out = [];
                hits_in = (result.hits || {}).hits || [];
                for(;ii < hits_in.length; ii++){
                    hits_out.push(hits_in[ii]._source);
                }
                deferred.resolve(hits_out);
            }, deferred.reject);

            return deferred.promise;
        };


        return {
            "search": search1,
            "search2": search2,
        };
    }]
);

/**
 * Create a controller to interact with the UI.
 */
mainApp.controller('mainAppCtrl',
    ['mainAppService', '$scope', '$location', function(items, $scope, $location){
        
        var initChoices = [
            "Pneumococcal Vac Polyvalent",
            "Bisacodyl",
            "Senna"
        ];
        var idx = Math.floor(Math.random() * initChoices.length);

        // Initialize the scope defaults.
        $scope.results = [];        // An array of recipe results to display
        $scope.page = 0;            // A counter to keep track of our current page
        $scope.allResults = false;  // Whether or not all results have been found.

        $scope.patients = [];

        $scope.gender = 0;

        $scope.searchTerm = $location.search().q || initChoices[idx];

        $scope.search = function(){
            $scope.page = 0;
            $scope.results = [];
            $scope.patients = [];
            $scope.allResults = false;
            $location.search(
                {'q': $scope.searchTerm}
                );
            $scope.loadMore();
        };

        $scope.loadMore = function(){
            items.search($scope.searchTerm, $scope.page++).then(function(results){
                if(results.length !== 10){
                    $scope.allResults = true;
                }

                var ii = 0;

                var subject_id;
                var list_subject = [];

                for(;ii < results.length; ii++){
                    $scope.results.push(results[ii]);
                    subject_id = results[ii].subject_id;
                    list_subject.push(subject_id);
                }

                items.search2(list_subject, 0, $scope.gender).then(function(results2) {
                    for (idx in results2) {
                        var patient = results2[idx];

                        var m_pres = [];

                        for (p_idx in $scope.results) {
                            var pres = $scope.results[p_idx];
                            if (pres.subject_id == patient.subject_id) {
                                m_pres.push(pres);
                            }
                        }

                        patient.prescriptions = m_pres;

                        $scope.patients.push(patient);
                    }
                });

                console.log($scope.patients);

            });
        };

        // Load results on first run
        $scope.loadMore();
    }]
);
