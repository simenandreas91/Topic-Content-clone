(function() {
    var portalRecord = $sp.getPortalRecord();
    data.widgetInstance = $sp.getValue('sys_id');
    data.showEmptyState = options.show_empty_state ? options.show_empty_state : 'true';
    data.defaultFilter = options.default_filter || 'all';
    data.lockFilter = options.lock_filter === 'true';
    data.EVENTS = new sn_ex_sp.ContentSearchUtils().getInstanceEvents(data.widgetInstance);
    data.aisEnabledUtah = gs.getProperty('taxonomy.aisearch.enabled.utah') == 'true' && $sp.isAISearchEnabled();
    var ais = new sn_ais.StatusApi();
    data.aisEnabledUtahMobile = gs.getProperty('taxonomy.aisearch.enabled.utah') == 'true' && ais.isAisEnabled() && ais.isAisInitialized();
    data.mespEmptyStateImage = new sn_ex_sp.TopicPageUtil().getDBImage("sn_ex_sp.MESP_empty_state_image_used.png");
    data.profileLang = gs.getSession().getLanguage();
    data.sys_id = $sp.getParameter('topic_id');
    data.in_context = $sp.getParameter('in_context');
    data.sys_id = gs.nil(data.sys_id) ? '-1' : data.sys_id;
    data.limit = parseInt(options.limit) || 12;
    data.widgetTitle = options && options.title ? gs.getMessage(options.title) : gs.getMessage("Support resources");
    // change this to use native mobile script to identify is mobile.
    data.isMobile = gs.isMobile();
    data.isMobileApp = $sp.getParameter('view') === 'mobile';
    if (data.isMobileApp) {
        data.limit = 5;
    }
    data.isLearningUpdated = GlidePluginManager.isActive('sn_lc');
    data.contentTableToWidget = {
        'sc_cat_item': 'catalog-content',
        'kb_knowledge': 'kb-content'
    };
    if (data.isLearningUpdated) {
        data.contentTableToWidget.sn_lc_course_item = 'learning-content';
    }

    //Employee Browser Extensioon Integration 	
    data.isECBEInstalled = GlidePluginManager.isActive('com.snc.ex_browser_extension');
    data.isECBEPortal = false;
    var ecbeUtils;
    if (data.isECBEInstalled) {
        ecbeUtils = new sn_ex_brw_ext.ECBEUtil();
        data.isECBEPortal = ecbeUtils.isECBEPortal($sp);
	if (data.isECBEPortal) {
		var currentWebsiteObject = ecbeUtils.fetchWebsiteFromSession(); 
		data.currentWebsite = gs.nil(currentWebsiteObject.website)? null:currentWebsiteObject.website;
	}		
    }

    var sortOptions = [{
        id: "popularity",
        name: gs.getMessage("Popular", "Popular")
    }, {
        id: "alphabetical",
        name: gs.getMessage("A-Z", "A-Z")
    }];
    var actions = {
        showMore: "show-more",
        filter: "filter",
        sort: "sort",
        storeView: "storeView",
        modifyAISResults: "modify-ais-results"
    };
    var REQUESTS = sn_i18n.Message.getMessage("sn_ex_sp", "Requests");
    var ARTICLES = gs.getMessage("Articles");
    var COURSES = gs.getMessage("Courses");
    data.showRedirectToGlobal = options.show_global_redirect === 'true';

    // AIS content search integration
    data.clearSearchBtn = gs.getMessage("Reset search");
    data.btnTitle = gs.getMessage("Search button");
    data.placeholder = gs.getMessage("Search resources");
    data.expandSearchMsg = gs.getMessage("Didn't find what you're looking for?");
    data.expandSearchLink = gs.getMessage("Expand your search");
    data.searchAppConfigId = portalRecord.getValue('search_application');

    try {
        var search_app_sys_id = options.search_application || data.searchAppConfigId;
        var filters = "";
        data.ui = {
            aisFacetFilters: [],
            aisSearchFilters: [],
            aisSortOptions: []
        };
        var searchConfig = new sn_ex_sp.TopicPageUtil().getSearchConfiguration(portalRecord.getUniqueValue(), data.widgetInstance);
        if (searchConfig) {
            search_app_sys_id = searchConfig.searchApplication;
            data.search_sources_filter = searchConfig.searchFilters;
            filters = searchConfig.searchFilters;
            getSearchConfigParams(search_app_sys_id, filters);
        } else {
            getSearchConfigParams(search_app_sys_id);
            var defaultSearchFilters = options.search_sources_filter || '';
            data.search_sources_filter = defaultSearchFilters.split(',');
            filters = defaultSearchFilters ? defaultSearchFilters.split(',') : data.ui.aisSearchFilters.map(function(f) {
                return f.sysId;
            });
        }
        data.searchWidgetInitOptions = {
            'facet': JSON.stringify(data.ui.aisFacetFilters).replaceAll('\\"', '\\\\\\\\"').replaceAll('"', '\\\\\\"'),
            'filter': JSON.stringify(filters).replaceAll('"', '\\\\\\"'),
            'sort': JSON.stringify([]).replaceAll('"', '\\\\\\"'),
            'searchConfigId': search_app_sys_id,
            'btnTitle': data.btnTitle,
            'placeholder': data.placeholder,
            'parentWidgetInstance': data.widgetInstance,
            'isMobileApp': data.isMobileApp
        };

        if (data.isMobileApp) {
            data.searchWidgetInitOptions.disableSpellCheck = true;
        }

        //if user does a search
        if (input && input.action === actions.modifyAISResults) {
            data.modifiedAISResponse = input.aisSearchResults.map(function(item) {
                item = postProcessAISResponse(item);
                return item;
            });
            addContentWidget(data.modifiedAISResponse);
            // initializing preferences object
            var preferences = JSON.stringify({
                filter: input.filterBy || '',
                sort: input.sortBy || data.sortBy,
                view: input.view || data.view,
                topic: data.sys_id,
                userId: gs.getUserID()
            });
            var preferencesObj = gs.getSession().getClientData("preferences");
            if (!preferencesObj) {
                gs.getSession().putClientData('preferences', preferences);
            }
            return;
        }
    } catch (err) {
        gs.error(gs.getMessage("Something went wrong!"));
    }

    // Browse specific data, not required for search
    data.sortOptions = input ? input.sortOptions : sortOptions;
    data.sortBy = options && options.sortby ? options.sortby : data.sortOptions[0].id;
    data.noContentMessage = '';
    data.excludeList = [];
    data.filterOptions = input ? input.filterOptions : getContentConfiguration();
    data.defaultFilterId = getDefaultFilterId(data.defaultFilter, data.filterOptions);
    data.filterBy = (!input ? data.defaultFilterId : '') || '';
    data.view = "card";
    data.featuredContent = [];
    data.content = [];

    if (!data.in_context) {
        var preferencesObj = gs.getSession().getClientData("preferences");
        if (preferencesObj) {
            var topic = JSON.parse(preferencesObj).topic;
            var userId = JSON.parse(preferencesObj).userId;
            data.in_context = (topic === data.sys_id) && (userId == gs.getUserID());
        }
        if (!data.in_context)
            gs.getSession().putClientData('preferences', null);
    }
    if (data.lockFilter) {
        data.filterBy = data.defaultFilterId || '';
    }
    if (data.in_context) {
        var usersPreference = gs.getSession().getClientData("preferences");
        if (usersPreference) {
            data.sortBy = JSON.parse(usersPreference).sort;
            data.filterBy = data.lockFilter ? data.defaultFilterId : JSON.parse(usersPreference).filter;
            data.view = JSON.parse(usersPreference).view;
        }
    }
    try {
        var topicJs = new sn_taxonomy.Topic(data.sys_id);
        data.title = gs.getMessage("Browse {0}", topicJs.getName());
        data.topicName = topicJs.getName();
        data.mobileNoContentMessage = gs.getMessage("<p>Choose a {0} topic to get more specific support.</p>", topicJs.getName());
        //override with input values. 
        if (input) {
            data.sortBy = input.sortBy || data.sortBy;
            data.filterBy = data.lockFilter ? data.defaultFilterId : (input.filterBy || data.filterBy);
            data.view = input.view || data.view;
            //Session cannot store objects, only Strings
            var preferences = JSON.stringify({
                filter: data.lockFilter ? data.defaultFilterId : data.filterBy,
                sort: data.sortBy,
                view: data.view,
                topic: data.sys_id,
                userId: gs.getUserID()
            });
            gs.getSession().putClientData('preferences', preferences); // Preferences should be retained in-context only.
            if (input.action === actions.storeView) {
                data.content = input.content;
                return;
            }
            //if user clicks show more exlude the existing featured content normal content.
            if (input.action === actions.showMore) {
                if (input.content.length > 0) {
                    data.excludeList = getContentIdList(input.content);
                    data.content = input.content;
                }
                if (input.featuredContent.length > 0) {
                    var exclude = getContentIdList(input.featuredContent);
                    data.featuredContent = input.featuredContent;
                    data.excludeList = data.excludeList.concat(exclude);
                }

            }
        }
        // do not fetch featured content on show more action
        if (!input || input.action !== actions.showMore) {
            var featuredContentCount = parseInt(gs.getProperty("taxonomy.content.featured_content_limit", "5"));
            data.featuredContent = fetchAcrossLanguages(function() {
                return new TopicServiceUtil().getFeaturedContent(data.sys_id, featuredContentCount, data.isMobileApp, data.filterBy);
            });
            if (data.featuredContent.length > featuredContentCount) {
                data.featuredContent = data.featuredContent.slice(0, featuredContentCount);
            }
            var featuredExcludeContent = getContentIdList(data.featuredContent);
            data.featuredContent = data.featuredContent.map(function(a) {
                a.isFeatured = true;
                return a;
            });
            addContentWidget(data.featuredContent);
            data.excludeList = data.excludeList.concat(featuredExcludeContent);
            // remove the featured content fetched length from limit so that it gets required limit set by customer.
            data.limit = Math.max(0, data.limit - featuredExcludeContent.length);
        }

        var filterOptions = data.filterOptions.map(function(filter) {
            return filter.sysId;
        });

        if (data.filterBy) {
            filterOptions = [data.filterBy];
        }

        var content = fetchAcrossLanguages(function() {
            return getContentForTopic(data.limit, data.isMobileApp, data.excludeList, filterOptions);
        });

        //Check if the length of content is more than limit then show "show more button"
        if (content.length > data.limit) {
            data.showMore = true;
            data.showMoreMsg = gs.getMessage("Show more");
            content = content.slice(0, data.limit);
        } else {
            data.showMore = false;
        }

        //Created Content widgets and addes them to content object
        addContentWidget(content);

        data.content = content;

        if (!gs.nil(data.filterBy) && data.content.length === 0) {
            var selectedFilterName = getSelectedFilterName(data.filterBy);
            data.noContentMessage = gs.getMessage("<h4 class=\"no-content-msg\">No results for <b>{0}</b></h4>", selectedFilterName);
        }

    } catch (ex) {
        gs.error(gs.getMessage("Invalid Topic Id."));
    }

    function getContentForTopic(limit, isMobile, excludeItems, contentConfigIds) {
        var includeChildTopics = true;
        if ((isMobile && gs.getProperty('sn_ex_sp.u_allow.rollup.mesp') === 'false') || options.content_displayed_from === 'Current topic only') {
            includeChildTopics = false;
        }
        limit = limit + 1;
        if (data.sortBy === "popularity")
            return new TopicServiceUtil().getContentByPopularity(data.sys_id, includeChildTopics, limit, isMobile, excludeItems, contentConfigIds);
        else
            return new TopicServiceUtil().getContent(data.sys_id, includeChildTopics, limit, isMobile, excludeItems, contentConfigIds);
    }

    function getContentConfiguration() {
        var configurations = [{
            sysId: "",
            name: gs.getMessage("All", "All"),
            contentTable: 'all'
        }];
        var contentConfigurationGr = new GlideRecord("taxonomy_content_configuration");
        contentConfigurationGr.addActiveQuery();
        contentConfigurationGr.query();
        while (contentConfigurationGr.next()) {
            if (!isContentConfigValid(contentConfigurationGr))
                continue;
            var configuration = {};
            configuration.sysId = contentConfigurationGr.getUniqueValue();
            configuration.name = getFilterName(contentConfigurationGr.content_table);
            configuration.contentTable = contentConfigurationGr.getValue('content_table');
            if (configuration.name)
                configurations.push(configuration);
        }
        return configurations;
    }

    function getFilterName(table) {
        var content_table_filter_map = {
            'sc_cat_item': REQUESTS,
            'kb_knowledge': ARTICLES,
            'sn_lc_course_item': COURSES
        };
        return content_table_filter_map[table];
    }

    function getDefaultFilterId(defaultFilter, filterOptions) {
        if (gs.nil(defaultFilter) || defaultFilter === 'all') {
            return '';
        }
        var defaultMatch = filterOptions.filter(function(filter) {
            return filter.contentTable === defaultFilter;
        });
        return defaultMatch.length ? defaultMatch[0].sysId : '';
    }

    function getAvailableLanguages(currentLanguage, canSwitchLanguage) {
        var languagesProperty = gs.getProperty('glide.ui.languages', '') || '';
        var languages = languagesProperty.split(',').map(function(lang) {
            return lang.trim();
        }).filter(function(lang) {
            return lang;
        });
        if (currentLanguage && languages.indexOf(currentLanguage) === -1) {
            languages.unshift(currentLanguage);
        }
        if (!languages.length && currentLanguage) {
            languages = [currentLanguage];
        }
        if (!canSwitchLanguage && languages.length) {
            return [languages[0]];
        }
        return languages;
    }

    function fetchAcrossLanguages(fetchFn) {
        var session = gs.getSession();
        var currentLanguage = session && session.getLanguage ? session.getLanguage() : '';
        var canSwitchLanguage = session && typeof session.setLanguage === 'function';
        var languages = getAvailableLanguages(currentLanguage, canSwitchLanguage);
        var collected = [];
        var seen = {};

        function collect(results) {
            (results || []).forEach(function(item) {
                if (!seen[item.content]) {
                    seen[item.content] = true;
                    collected.push(item);
                }
            });
        }

        if (canSwitchLanguage && languages.length) {
            try {
                for (var i = 0; i < languages.length; i++) {
                    session.setLanguage(languages[i]);
                    collect(fetchFn());
                }
            } finally {
                session.setLanguage(currentLanguage);
            }
        } else {
            collect(fetchFn());
        }
        return collected;
    }

    function getContentIdList(content) {
        return content.map(function(a) {
            return a.content;
        });
    }

    function getSelectedFilterName(sysId) {
        var selectedFilter = data.filterOptions.filter(function(filter) {
            return filter.sysId === sysId;
        });
        return selectedFilter.length > 0 ? selectedFilter[0].name : '';
    }

    function addContentWidget(content) {
        var displayedItemsCount = input && input.focusIndex || 0;
        content.map(function(a, index) {
            a.widgetTitle = data.title;
            a.topicForBreadcrumb = data.sys_id;
            a.index = displayedItemsCount + index + 1;
            a.widgetData = $sp.getWidget(data.contentTableToWidget[a.content_table], a);
        });
    }

    function postProcessAISResponse(item) {
        item.content_table = item.table;
        item.content = item.sysId;
        item.sys_id = item.sysId;
        item.searchModeEnabled = true;
        item.topicForBreadcrumb = data.sys_id;
        item.columns.forEach(function(col) {
            var key = col.fieldName;
            var displayVal = col.displayValue;
            item[key] = displayVal;
        });

        switch (item.table) {
            case 'sc_cat_item': {
                item.short_description = item.text;
                item.show_price = item.price ? true : false;
                item.name = item.title ? item.title : item.name;
                break;
            }
            default:
                break;
        }

        return item;
    }

    function getSearchConfigParams(search_app_sys_id, filters) {
        var relatedListsTables = [{
                table_name: 'sys_search_filter',
                data_key: 'filter',
                data_column_label: 'label'
            },
            {
                table_name: 'sys_search_sort_option',
                data_key: 'sort',
                data_column_label: 'gui_label'
            },
        ];

        relatedListsTables.forEach(function(table) {
            var listGR = new GlideRecord(table.table_name);
            listGR.addQuery('search_context_config', search_app_sys_id);
            if (table.table_name === 'sys_search_filter' && filters && filters.length > 0) {
                listGR.addQuery('sys_id', 'IN', filters.join(','));
            }
            listGR.query();
            while (listGR.next()) {
                var uniqueID = listGR.getUniqueValue();
                createAISFilterSortOptions(table.table_name, uniqueID, listGR.getValue(table.data_column_label));
            }
        });

        data.ui.aisFacetFilters = getFacetFilters(data.sys_id);
    }

    function createAISFilterSortOptions(table_name, uniqueID, label) {
        if (table_name === "sys_search_filter") {
            data.ui.aisSearchFilters.push({
                sysId: uniqueID,
                label: label
            });
        } else if (table_name === "sys_search_sort_option") {
            data.ui.aisSortOptions.push({
                sysId: uniqueID,
                label: label
            });
        }
    }

    function getFacetFilters(topicId) {
        var topicGR = new GlideRecord('topic');
        var topicPath = '',
            currentTopicName = '';
        if (topicGR.get(topicId)) {
            topicPath = topicGR.getDisplayValue('topic_path');
            currentTopicName = topicGR.getDisplayValue('name');
            data.title = gs.getMessage("Browse {0}", currentTopicName);
        }
        var topic_level = topicPath ? topicPath.split('/').length - 1 : 0;

        var facetFields = ['_kb_knowledge.topic_level_', '_sc_cat_item.topic_level_', '_sn_lc_course_item.topic_level_'];
        var facetFieldsMobile = ['_kb_knowledge', '_sc_cat_item', '_sn_lc_course_item'];

        if ((!data.isMobileApp || gs.getProperty('sn_ex_sp.u_allow.rollup.mesp') === 'true') && options.content_displayed_from === 'Current topic and all child topics') {
            return [('"UNION(' + facetFields.map(function(f) {
                return f + topic_level + '_s';
            }).join(',') + ')"' + ':FACET("' + currentTopicName + '")')];
        }

        return [('"UNION(' + facetFieldsMobile.map(function(f) {
            return f + '.topic_path_s';
        }).join(',') + ')"' + ':FACET("' + topicPath + '")')];
    }

    function isContentConfigValid(contentConfigGr) {
        var connectedContentGr = new GlideRecord('m2m_connected_content');
        if (connectedContentGr.isValidField(contentConfigGr.getValue('content_reference_field')))
            return true;

        return false;
    }
    return data;
})();
