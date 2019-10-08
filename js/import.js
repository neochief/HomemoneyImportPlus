var EMPTY_VAL = ["empty", "не выбрана"];
var is_empty_category = function (c) {
    return EMPTY_VAL.indexOf(c) !== -1;
};

var IGNORE_TRANSACTION = [
    "Начисление процентов на остаток средств по договору HEAD-OFFICE , MANUAL",
    "Перевод процентов, начисленных на остаток собственных средств, на счет «Бонус Плюс» HEAD-OFFICE , MANUAL",
    "Удержание налога с начисленных на остаток собственных средств на карте процентов HEAD-OFFICE , MANUAL",
    "Отмена предавторизации: ITUNES.COM/BILL ITUNES.COM/BILL, 00207002",
    "Предавторизация: ITUNES.COM/BILL ITUNES.COM/BILL, 00207002"
];
var is_ignored_transaction = function (t) {
    return IGNORE_TRANSACTION.indexOf(t) !== -1;
};

var Categories = {
    data: {},

    load: function () {
        try {
            var localCategories = localStorage.getItem('categories');
            this.data = JSON.parse(localCategories) || {};
        } catch (e) {
        }
    },

    save: function () {
        try {
            var localCategories = JSON.stringify(localCategories);
            localStorage.setItem('categories', localCategories);
        } catch (e) {
        }
    },

    set: function (description, category, amount, overrideIfExisting) {
        description = this.normalizeDescription(description);
        if (!description) {
            return;
        }

        category = this.normalizeCategory(description, category, amount);
        if (!category || is_empty_category(category)) {
            return;
        }

        amount = this.normalizeAmount(amount);

        if (overrideIfExisting || typeof this.data[description] === "undefined") {
            this.data[description] = category;
            this.save();
        }
    },

    findCategory: function (description, amount) {
        description = this.normalizeDescription(description);
        amount = this.normalizeAmount(amount);

        return this.data[description] || null;
    },

    normalizeDescription: function (description) {
        description = html_entity_decode(description);
        description = description.replace(/, [0-9A-Z]{8}$/, '');

        return description;
    },

    normalizeCategory: function (description, category) {
        return category;
    },

    normalizeAmount: function (amount) {
        return parseFloat(amount.replace(',', '.').replace(' ', ''));
    },

    clear: function () {
        this.data = {};
        this.save();
    }
};

var Import = {
    start: function () {
        var interval = setInterval(function () {
            if (!$('#global_modalPopup').is(':visible')) {
                console.log('Processing import transactions.');
                clearInterval(interval);

                this.initDivs();
                this.monitorFilterChanges();
            }
        }.bind(this), 100);
    },

    monitorFilterChanges: function () {
        var interval = setInterval(function () {
            if ($('#global_modalPopup').is(':visible')) {
                console.log('Detected filter change, restarting.');
                clearInterval(interval);

                this.start();
            }
        }.bind(this), 100);
    },

    initDivs: function () {
        var all_categories = {};
        $('.reconciliation_transaction_theirs_item_info_category').first().find('option').each(function (i, option) {
            var $option = $(option);

            var category_name = $option.text();

            if (is_empty_category(category_name)) {
                return;
            }

            category_name = category_name.replace(/^[→↓↑*\s]+/, '');
            category_name = category_name.replace(/[→↓↑*\s]+$/, '');

            all_categories[category_name] = $option.val();
        }.bind(this));


        $('.reconciliation_transaction').each(function (i, transaction_day) {
            var $transaction_day = $(transaction_day);

            $('.reconciliation_transaction_theirs_item', $transaction_day).each(function (i, transaction_theirs_div) {
                var $transaction_theirs_div = $(transaction_theirs_div);

                var description = html_entity_decode($transaction_theirs_div.find('.reconciliation_transaction_theirs_item_info_description').val());
                if (is_ignored_transaction(description)) {
                    $transaction_theirs_div.addClass('imported');
                    return;
                }

                var category = $transaction_theirs_div.find('.reconciliation_transaction_theirs_item_info_category').val();
                var amount = $transaction_theirs_div.find('.reconciliation_transaction_theirs_item_total_val').text();

                if (is_empty_category(category)) {
                    this.setCategoriesInDiv($transaction_theirs_div);
                } else {
                    this.importCategoriesFromDiv($transaction_theirs_div);
                }

                $('.reconciliation_transaction_mine_item:not(.imported)', $transaction_day).each(function (i, transaction_mine_div) {
                    var $transaction_mine_div = $(transaction_mine_div);

                    var $amount_span = $transaction_mine_div.find('.reconciliation_transaction_mine_item_total span');
                    var amount2;
                    if ($amount_span.eq(1).is(':visible')) {
                        amount2 = $amount_span.eq(1).find('span').text().replace(/^[→↓↑*\s]+/, '');
                    } else {
                        amount2 = $amount_span.eq(0).text();
                        if ($amount_span.eq(0).is('.negative')) {
                            amount2 = '-' + amount2;
                        }
                    }

                    if (amount === amount2) {
                        $transaction_theirs_div.addClass('imported');
                        $transaction_mine_div.addClass('imported');
                        return;
                    }
                }.bind(this));

                if (!$transaction_theirs_div.parents('.reconciliation_transaction').find('.reconciliation_transaction_date_title.equally').length &&
                    !$transaction_theirs_div.is('.imported')) {
                    $('.reconciliation_transaction_theirs_item_total_chkbox', $transaction_theirs_div).prop('checked', true);
                }

            }.bind(this));

        }.bind(this));

        $('.reconciliation_transaction_theirs_item_info_category').each(function (i, select) {
            var $select = $(select);
            $select.show();
            $select.siblings('.chzn-container').hide();
            var is_ready = !is_empty_category($select.val()) || $select.parents('.reconciliation_transaction_theirs_item').is('.imported');
            $select.toggleClass('ready', is_ready);
            $select.toggleClass('not-ready', !is_ready);

            $select.bind('change', function (event) {
                var $select = $(event.target);
                var is_ready = !is_empty_category($select.val()) || $select.parents('.reconciliation_transaction_theirs_item').is('.imported');
                $select.toggleClass('ready', is_ready);
                $select.toggleClass('not-ready', !is_ready);
                this.importCategoriesFromDiv($select.parents('.reconciliation_transaction_theirs_item'), true);
                this.initDivsFast();
            }.bind(this));
        }.bind(this));
    },

    initDivsFast: function() {
        $('.reconciliation_transaction').each(function (i, transaction_day) {
            var $transaction_day = $(transaction_day);
            $('.reconciliation_transaction_theirs_item', $transaction_day).each(function (i, transaction_theirs_div) {
                var $transaction_theirs_div = $(transaction_theirs_div);
                var category = $transaction_theirs_div.find('.reconciliation_transaction_theirs_item_info_category').val();
                if (is_empty_category(category)) {
                    this.setCategoriesInDiv($transaction_theirs_div);
                } else {
                    this.importCategoriesFromDiv($transaction_theirs_div);
                }
            }.bind(this));
        }.bind(this));
    },

    importCategoriesFromDiv: function ($transaction_div, overrideIfExisting) {
        var description = $transaction_div.find('.reconciliation_transaction_theirs_item_info_description').val();
        var category = $transaction_div.find('.reconciliation_transaction_theirs_item_info_category').val();
        var amount = $transaction_div.find('.reconciliation_transaction_theirs_item_total_val').val();

        Categories.set(description, category, amount, overrideIfExisting);
    },

    setCategoriesInDiv: function ($transaction_div, reinit) {
        var description = $transaction_div.find('.reconciliation_transaction_theirs_item_info_description').val();
        var amount = $transaction_div.find('.reconciliation_transaction_theirs_item_total_val').val();

        var category = Categories.findCategory(description, amount);
        if (category) {
            $transaction_div.find('.reconciliation_transaction_theirs_item_info_category').addClass('ready').val(category);
        }
    }
};

$(document).ready(function () {
    Categories.load();
    Import.start();
});

function html_entity_decode(string, quote_style) {
    //  discuss at: http://phpjs.org/functions/html_entity_decode/
    // original by: john (http://www.jd-tech.net)
    //    input by: ger
    //    input by: Ratheous
    //    input by: Nick Kolosov (http://sammy.ru)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: marc andreu
    //  revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    //  revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // bugfixed by: Onno Marsman
    // bugfixed by: Brett Zamir (http://brett-zamir.me)
    // bugfixed by: Fox
    //  depends on: get_html_translation_table
    //   example 1: html_entity_decode('Kevin &amp; van Zonneveld');
    //   returns 1: 'Kevin & van Zonneveld'
    //   example 2: html_entity_decode('&amp;lt;');
    //   returns 2: '&lt;'

    if (string.indexOf('&') == -1) {
        return string;
    }

    var symbol = '',
        tmp_str = '',
        entity = '';
    tmp_str = string.toString();

    for (symbol in window.hash_map) {
        entity = window.hash_map[symbol];
        tmp_str = tmp_str.split(entity)
            .join(symbol);
    }
    tmp_str = tmp_str.split('&#039;').join("'");

    return tmp_str;
}

function get_html_translation_table(table, quote_style) {
    //  discuss at: http://phpjs.org/functions/get_html_translation_table/
    // original by: Philip Peterson
    //  revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // bugfixed by: noname
    // bugfixed by: Alex
    // bugfixed by: Marco
    // bugfixed by: madipta
    // bugfixed by: Brett Zamir (http://brett-zamir.me)
    // bugfixed by: T.Wild
    // improved by: KELAN
    // improved by: Brett Zamir (http://brett-zamir.me)
    //    input by: Frank Forte
    //    input by: Ratheous
    //        note: It has been decided that we're not going to add global
    //        note: dependencies to php.js, meaning the constants are not
    //        note: real constants, but strings instead. Integers are also supported if someone
    //        note: chooses to create the constants themselves.
    //   example 1: get_html_translation_table('HTML_SPECIALCHARS');
    //   returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}

    var entities = {},
        hash_map = {},
        decimal;
    var constMappingTable = {},
        constMappingQuoteStyle = {};
    var useTable = {},
        useQuoteStyle = {};

    // Translate arguments
    constMappingTable[0] = 'HTML_SPECIALCHARS';
    constMappingTable[1] = 'HTML_ENTITIES';
    constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
    constMappingQuoteStyle[2] = 'ENT_COMPAT';
    constMappingQuoteStyle[3] = 'ENT_QUOTES';

    useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
    useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() :
        'ENT_COMPAT';

    if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
        throw new Error('Table: ' + useTable + ' not supported');
        // return false;
    }

    entities['38'] = '&amp;';
    if (useTable === 'HTML_ENTITIES') {
        entities['160'] = '&nbsp;';
        entities['161'] = '&iexcl;';
        entities['162'] = '&cent;';
        entities['163'] = '&pound;';
        entities['164'] = '&curren;';
        entities['165'] = '&yen;';
        entities['166'] = '&brvbar;';
        entities['167'] = '&sect;';
        entities['168'] = '&uml;';
        entities['169'] = '&copy;';
        entities['170'] = '&ordf;';
        entities['171'] = '&laquo;';
        entities['172'] = '&not;';
        entities['173'] = '&shy;';
        entities['174'] = '&reg;';
        entities['175'] = '&macr;';
        entities['176'] = '&deg;';
        entities['177'] = '&plusmn;';
        entities['178'] = '&sup2;';
        entities['179'] = '&sup3;';
        entities['180'] = '&acute;';
        entities['181'] = '&micro;';
        entities['182'] = '&para;';
        entities['183'] = '&middot;';
        entities['184'] = '&cedil;';
        entities['185'] = '&sup1;';
        entities['186'] = '&ordm;';
        entities['187'] = '&raquo;';
        entities['188'] = '&frac14;';
        entities['189'] = '&frac12;';
        entities['190'] = '&frac34;';
        entities['191'] = '&iquest;';
        entities['192'] = '&Agrave;';
        entities['193'] = '&Aacute;';
        entities['194'] = '&Acirc;';
        entities['195'] = '&Atilde;';
        entities['196'] = '&Auml;';
        entities['197'] = '&Aring;';
        entities['198'] = '&AElig;';
        entities['199'] = '&Ccedil;';
        entities['200'] = '&Egrave;';
        entities['201'] = '&Eacute;';
        entities['202'] = '&Ecirc;';
        entities['203'] = '&Euml;';
        entities['204'] = '&Igrave;';
        entities['205'] = '&Iacute;';
        entities['206'] = '&Icirc;';
        entities['207'] = '&Iuml;';
        entities['208'] = '&ETH;';
        entities['209'] = '&Ntilde;';
        entities['210'] = '&Ograve;';
        entities['211'] = '&Oacute;';
        entities['212'] = '&Ocirc;';
        entities['213'] = '&Otilde;';
        entities['214'] = '&Ouml;';
        entities['215'] = '&times;';
        entities['216'] = '&Oslash;';
        entities['217'] = '&Ugrave;';
        entities['218'] = '&Uacute;';
        entities['219'] = '&Ucirc;';
        entities['220'] = '&Uuml;';
        entities['221'] = '&Yacute;';
        entities['222'] = '&THORN;';
        entities['223'] = '&szlig;';
        entities['224'] = '&agrave;';
        entities['225'] = '&aacute;';
        entities['226'] = '&acirc;';
        entities['227'] = '&atilde;';
        entities['228'] = '&auml;';
        entities['229'] = '&aring;';
        entities['230'] = '&aelig;';
        entities['231'] = '&ccedil;';
        entities['232'] = '&egrave;';
        entities['233'] = '&eacute;';
        entities['234'] = '&ecirc;';
        entities['235'] = '&euml;';
        entities['236'] = '&igrave;';
        entities['237'] = '&iacute;';
        entities['238'] = '&icirc;';
        entities['239'] = '&iuml;';
        entities['240'] = '&eth;';
        entities['241'] = '&ntilde;';
        entities['242'] = '&ograve;';
        entities['243'] = '&oacute;';
        entities['244'] = '&ocirc;';
        entities['245'] = '&otilde;';
        entities['246'] = '&ouml;';
        entities['247'] = '&divide;';
        entities['248'] = '&oslash;';
        entities['249'] = '&ugrave;';
        entities['250'] = '&uacute;';
        entities['251'] = '&ucirc;';
        entities['252'] = '&uuml;';
        entities['253'] = '&yacute;';
        entities['254'] = '&thorn;';
        entities['255'] = '&yuml;';
    }

    if (useQuoteStyle !== 'ENT_NOQUOTES') {
        entities['34'] = '&quot;';
    }
    if (useQuoteStyle === 'ENT_QUOTES') {
        entities['39'] = '&#39;';
    }
    entities['60'] = '&lt;';
    entities['62'] = '&gt;';

    // ascii decimals to real symbols
    for (decimal in entities) {
        if (entities.hasOwnProperty(decimal)) {
            hash_map[String.fromCharCode(decimal)] = entities[decimal];
        }
    }

    return hash_map;
}

window.hash_map = get_html_translation_table('HTML_ENTITIES', 'ENT_QUOTES');
delete (window.hash_map['&']);
window.hash_map['&'] = '&amp;';