api.controller = function($timeout, $rootScope, $scope, $window, snAnalytics, spAriaUtil, i18n) {
    var c = this;
    var CARD_VIEW = "card";
    var LIST_VIEW = "list";
    var FLEX_CARD_SELECTOR = '.flex-item-card';
    var CONTENT_CARD_SELECTOR = c.data.isMobileApp ? '.content-card-mobile' : '.content-card a';
    var actions = {
        showMore: "show-more",
        filter: "filter",
        sort: "sort",
        modifyAISResults: "modify-ais-results"
    };
    $scope.loading = false;
    $scope.contentItems = [];

    // AIS search integration
    $scope.isBackFromGlobalSearch = false;
    $scope.searchAppConfigId = c.options.searchAppSysId;
    $scope.isSearchModeEnabled = false;
    $scope.searchedTerm = "";
    $scope.spellCorrectedTerm = "";
    $scope.noOfNewItems = 0;
    $scope.aisContentItems = [];
    $scope.aisFilterOptions = [];
    $scope.aisSortOptions = [];
    $scope.hasNext = false;
    $scope.nextIndexMobileSearch = 0;
    $scope.mobileSearchResCount = 5;
    $scope.showMoreFlagMobileSearch = false;
    c.data.getNext = false;
    c.data.aisFilterBy = '';
    c.data.aisSortBy = '';
    c.data.mespEmptyStateImage = "";
    var AIS_EVENTS = c.data.EVENTS;

    $timeout(function() {
        $scope.populateFilterAndSortOptions(c.data.ui.aisSearchFilters, c.data.ui.aisSortOptions);
    }, 0, false);

    var aisModeChangeDestroy = $rootScope.$on(AIS_EVENTS.AIS_MODE_CHANGE_EVENT, function(event, data) {
        $scope.isSearchModeEnabled = data.searchModeEnabled;
        if (!$scope.isSearchModeEnabled) {
            $scope.resetAISParams();
        }
    });

    var aisLoadingDestroy = $rootScope.$on(AIS_EVENTS.AIS_LOADING_EVENT, function(event, data) {
        if (data.isAISloading) {
            $scope.loading = data.isAISloading;
            if (!data.loadingNext)
                $scope.aisContentItems = [];
        }

    });

    var resultsUpdatedDestroy = $rootScope.$on(AIS_EVENTS.AIS_RESULTS_UPDATED_EVENT, function(event, data) {
        $scope.searchedTerm = data.searchedTerm;
        $scope.spellCorrectedTerm = data.spellCorrectedTerm;
        $scope.hasNext = data.hasNext;
        $scope.populateFilterAndSortOptions(data.filterOptions, data.sortOptions);
        $scope.modifyAISResultsData(data.results, c.data.action === actions.showMore);
        $scope.noOfNewItems = data.results.length;
        c.announceNewItemsAvailable();
        if (data.results.length === 0) {
            $scope.loading = false;
        }
    });

    c.announceNewItemsAvailable = function() {
        $scope.newItemsAnnouncement = "";

        i18n.getMessage("{0} new items available", function(translatedMsg) {
            var msg = translatedMsg.withValues([$scope.noOfNewItems]);
            $scope.newItemsAnnouncement = msg;
        });
    };


    $scope.populateFilterAndSortOptions = function(allAISFilterOptions, allAISSortOptions) {
        $scope.aisFilterOptions = [{
            name: '${All}',
            sysId: ''
        }].concat(allAISFilterOptions.filter(function(f) {
            return c.data.search_sources_filter.includes(f.sysId);
        }).map(function(item) {
            return {
                name: item.label,
                sysId: item.sysId
            };
        }));
        $scope.aisSortOptions = [{
            name: '${Most relevant}',
            id: ''
        }].concat(allAISSortOptions.map(function(item) {
            return {
                name: item.label,
                id: item.sysId
            };
        }));
    };

    $scope.$on('ngRepeatFinishedContentCards', function(ngRepeatFinishedEvent) {
        $scope.loading = false;
    });

    $scope.$on('$destroy', function() {
        aisModeChangeDestroy();
        aisLoadingDestroy();
        resultsUpdatedDestroy();
    });

    $scope.resetAISParams = function() {
        $scope.noOfNewItems = 0;
        $scope.aisContentItems = [];
        c.data.aisFilterBy = '';
        c.data.aisSortBy = '';
        c.data.searchedQuery = '';
        c.data.searchQuery = '';
        $window.sessionStorage.removeItem("topicSearchPreferences");
    };

    $scope.clearSearch = function() {
        $rootScope.$broadcast(AIS_EVENTS.AIS_MODE_CHANGE_EVENT, {
            searchModeEnabled: false,
        });
        $scope.getUpdatedContent();
        c.data.filter = JSON.stringify(c.data.search_sources_filter).replaceAll('"', '\\\\\\"');
        $rootScope.$broadcast(AIS_EVENTS.AIS_RESET_FILTERS_FACETS_AND_SORT, c.data);
        if (c.data.isMobile) {
            $scope.nextIndexMobileSearch = 0;
        }
    };

    $scope.refreshResults = function(searchParams) {
        if (searchParams) {
            c.data.searchQuery = searchParams.search_term;
            c.data.filter = JSON.stringify(searchParams.filter === '' ? c.data.search_sources_filter : [searchParams.filter]).replaceAll('"', '\\\\\\"');
            c.data.sort = JSON.stringify(searchParams.sort === '' ? [] : [searchParams.sort]).replaceAll('"', '\\\\\\"');
            c.data.spellCheck = searchParams.disable_spell_check || false;
        }
        $rootScope.$broadcast(AIS_EVENTS.AIS_REFRESH_RESULTS_EVENT, c.data);
    };

    $scope.getContentItems = function() {
        if ($scope.isSearchModeEnabled) {
            $scope.aisContentItems = $scope.aisContentItems.filter(function(results) {
                return results.table !== "sys_attachment";
            });
            if (c.data.isMobileApp) {
                var searchData = $scope.aisContentItems.slice(0, $scope.nextIndexMobileSearch + $scope.mobileSearchResCount);
                $scope.showMoreFlagMobileSearch = $scope.aisContentItems.length > ($scope.nextIndexMobileSearch + $scope.mobileSearchResCount) || $scope.hasNext;
                return searchData;
            }
            return $scope.aisContentItems;
        }
        return $scope.contentItems;
    };

    $scope.modifyAISResultsData = function(aisSearchResults, isConcat) {
        c.data.action = actions.modifyAISResults;
        c.data.aisSearchResults = aisSearchResults;
        c.data.searchedQuery = $scope.searchedTerm;

        var aisPreferences = JSON.stringify({
            aisFilterBy: c.data.aisFilterBy,
            aisSortBy: c.data.aisSortBy,
            aisSearchQ: c.data.searchedQuery,
            profileLang: c.data.profileLang
        });
        $window.sessionStorage.setItem("topicSearchPreferences", aisPreferences);
        var focusIndex = $scope.aisContentItems.length;
        c.data.focusIndex = focusIndex;
        c.server.update().then(function(response) {
            if (isConcat) {
                $scope.aisContentItems = $scope.aisContentItems.concat(response.modifiedAISResponse);
                $timeout(function() {
                    $(CONTENT_CARD_SELECTOR).get(focusIndex).focus();
                }, 100);
            } else
                $scope.aisContentItems = response.modifiedAISResponse;
        });
    };

    $scope.getExpandSearchURL = function() {
        var facetFilters = encodeURI(JSON.stringify(c.data.ui.aisFacetFilters));
        return "?id=search&spa=1&q=" + $scope.searchedTerm + "&disableSpellCheck=false";
    };

    $scope.toGlobalSearch = function() {
        $scope.setSessionData();
        $window.location.href = $scope.getExpandSearchURL();
    };

    $scope.setSessionData = function() {
        var aisSearchParams = {
            aisSearchQ: $scope.searchedTerm,
            aisFilterBy: c.data.aisFilterBy,
            aisSortBy: c.data.aisSortBy,
        };
        $window.sessionStorage.setItem("aisSearchParams", JSON.stringify(aisSearchParams));
    };

    c.createAppseeEvent = function() {
        var payload = {};
        payload.name = 'Topic Page Visits';
        payload.data = {};
        payload.data['Topic Name'] = c.data.topicName;
        payload.data['Topic Id'] = c.data.sys_id;
        if (c.data.isECBEPortal && c.data.currentWebsite)
            payload.data['Website'] = new URL(c.data.currentWebsite).hostname;
        snAnalytics.addEvent(payload);
    };

    if (c.data.sys_id != -1)
        c.createAppseeEvent();

    if (c.data) {
        $scope.contentItems = c.data.featuredContent.concat(c.data.content);
    }

    $scope.loadMore = function() {
        c.data.action = actions.showMore;
        var focusIndex = c.data.content.length;
        if ($scope.isSearchModeEnabled) {
            if (!c.data.isMobileApp || ($scope.nextIndexMobileSearch + (2 * $scope.mobileSearchResCount) > $scope.aisContentItems.length && $scope.hasNext)) {
                c.data.getNext = true;
                $scope.refreshResults();
            }
            if (c.data.isMobileApp) {
                $scope.nextIndexMobileSearch += $scope.mobileSearchResCount;
            }
            return;
        }
        return $scope.updateContent(actions.showMore, c.data.getNext).then(function() {
            $timeout(function() {
                $(CONTENT_CARD_SELECTOR).get(focusIndex).focus();
            }, 100);
        });
    };

    $scope.loadMoreKeydown = function(event) {
        if (event.which === 32 || event.which === 13) {
            c.data.action = actions.showMore;
            event.preventDefault();
            var focusIndex = c.data.content.length;
            if ($scope.isSearchModeEnabled) {
                c.data.getNext = true;
                $scope.refreshResults();
                return;
            }
            $scope.loadMore().then(function() {
                $timeout(function() {
                    $(CONTENT_CARD_SELECTOR).get(focusIndex).focus();
                }, 100);
            });
        }
    };

    $scope.getLiveFilteredListCount = function() {
        var contentItemsCount = $scope.contentItems.length;
        if (contentItemsCount) {
            spAriaUtil.sendLiveMessage(contentItemsCount + "${ results found}");
        } else {
            spAriaUtil.sendLiveMessage("${No results found}");
        }
    };

    $scope.getUpdatedContent = function() {
        c.data.action = actions.filter;
        c.data.getNext = false;
        if ($scope.isSearchModeEnabled) {
            var searchParams = {
                filter: c.data.aisFilterBy,
                sort: c.data.aisSortBy,
            };
            $scope.refreshResults(searchParams);
            return;
        }
        return $scope.updateContent(actions.filter, c.data.getNext);
    };

    $scope.updateContent = function(action, getNext) {
        $scope.loading = true;
        var isShowMore = action === actions.showMore;
        var input = {
            "action": c.data.action,
            "getNext": c.data.getNext,
            "sortOptions": c.data.sortOptions,
            "filterOptions": c.data.filterOptions,
            "filterBy": c.data.filterBy,
            "sortBy": c.data.sortBy,
            "featuredContent": c.data.featuredContent,
            "aisEnabledUtah": c.data.aisEnabledUtah,
            "aisEnabledUtahMobile": c.data.aisEnabledUtahMobile,
            "aisFilterBy": c.data.aisFilterBy,
            "aisSortBy": c.data.aisSortBy,
            "ais_topic_search": c.data.ais_topic_search,
            "btnTitle": c.data.btnTitle,
            "clearSearchBtn": c.data.clearSearchBtn,
            "expandSearchLink": c.data.expandSearchLink,
            "expandSearchMsg": c.data.expandSearchMsg,
            "in_context": c.data.in_context,
            "isLearningUpdated": c.data.isLearningUpdated,
            "isMobile": c.data.isMobile,
            "isMobileApp": c.data.isMobileApp,
            "limit": c.data.limit,
            "mespEmptyStateImage": c.data.mespEmptyStateImage,
            "mobileNoContentMessage": c.data.mobileNoContentMessage,
            "noContentMessage": c.data.noContentMessage,
            "placeholder": c.data.placeholder,
            "profileLang": c.data.profileLang,
            "searchAppConfigId": c.data.searchAppConfigId,
            "searchWidgetInitOptions": c.data.searchWidgetInitOptions,
            "search_sources_filter": c.data.search_sources_filter,
            "sessionRotationTrigger": c.data.sessionRotationTrigger,
            "showMore": c.data.showMore,
            "showMoreMsg": c.data.showMoreMsg,
            "showRedirectToGlobal": c.data.showRedirectToGlobal,
            "sys_id": c.data.sys_id,
            "title": c.data.title,
            "topicName": c.data.topicName,
            "ui": c.data.ui,
            "view": c.data.view,
            "widgetInstance": c.data.widgetInstance
        }
        if (isShowMore) {
            input.content = c.data.content.map(function(item) {
                return { content: item.content };
            });
        }
        return $scope.server.get(input).then(function(response) {
            c.data.content = isShowMore ? c.data.content.concat(response.data.content) : response.data.content;
            c.data.showMore = response.data.showMore;
            c.data.showMoreMsg = response.data.showMoreMsg;
            c.data.noContentMessage = response.data.noContentMessage;
            c.data.featuredContent = response.data.featuredContent;
            $scope.contentItems = c.data.featuredContent.concat(c.data.content);
            $scope.getLiveFilteredListCount();
            $scope.loading = false;
        });
    };

    $scope.changeView = function(view) {
        //data.view changes to input.view when server.update is called. 
        c.data.view = view;
        c.data.action = "storeView";
        c.server.update();
    };

    $scope.switchTab = function($event) {
        if ($event.which == 13 || $event.which == 32) {
            $event.stopPropagation();
            var layout = c.data.view === CARD_VIEW ? LIST_VIEW : CARD_VIEW;
            $scope.changeView(layout);
            $('#tab-' + layout).focus();
        }
    };

    $scope.isTouchDevice = function() {
        return ('ontouchstart' in $window);
    };

    $scope.handleCorrectedSearch = function(term, type) {
        var searchParams = {
            search_term: term,
            filter: c.data.aisFilterBy,
            sort: c.data.aisSortBy,
            disable_spell_check: type === 'search-term'
        };
        $scope.refreshResults(searchParams);
    };

    var destroyWidgetWatcher = $scope.$watch(
        function() {
            return $("[widget = 'widget'][sn-atf-area='AIS Topic Search']").length;
        },
        function(newValue, oldValue) {
            var searchParams = {};

            function refreshOnLoad(searchParams) {
                c.data.aisFilterBy = searchParams.filter;
                c.data.aisSortBy = searchParams.sort;
                $scope.refreshResults(searchParams);
                destroyWidgetWatcher();
            }
            if (newValue !== oldValue) {
                if ($window.sessionStorage.getItem('topicSearchPreferences')) {
                    var inContextSearchParams = $window.sessionStorage.getItem('topicSearchPreferences');
                    if (inContextSearchParams) {
                        inContextSearchParams = JSON.parse(inContextSearchParams);
                        searchParams = {
                            search_term: inContextSearchParams.aisSearchQ,
                            filter: inContextSearchParams.aisFilterBy,
                            sort: inContextSearchParams.aisSortBy,
                            profileLang: inContextSearchParams.profileLang
                        };
                        if (!c.data.in_context || searchParams.profileLang !== c.data.profileLang) {
                            $window.sessionStorage.removeItem("topicSearchPreferences");
                        } else
                            refreshOnLoad(searchParams);
                    }
                }
                if ($window.sessionStorage.getItem('isBackFromGS') === "true" && $window.sessionStorage.getItem('aisSearchParams')) {
                    var aisSearchParams = JSON.parse($window.sessionStorage.getItem('aisSearchParams'));
                    searchParams = {
                        search_term: aisSearchParams.aisSearchQ,
                        filter: aisSearchParams.aisFilterBy,
                        sort: aisSearchParams.aisSortBy,
                    };
                    refreshOnLoad(searchParams);
                }
                $window.sessionStorage.removeItem('aisSearchParams');
                $window.sessionStorage.removeItem('isBackFromGS');
            }
        }
    );

    $window.addEventListener('popstate', function() {
        $window.sessionStorage.setItem('isBackFromGS', "true");
    });

};