"use strict";
// src/core/utils/plan-limits.ts
// Plan limit types, constants, and helper functions for the SISWIT pricing model.
// Author: Solanki
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = exports.PLAN_PRICES = void 0;
exports.getLimit = getLimit;
exports.isUnlimited = isUnlimited;
exports.getUsagePercent = getUsagePercent;
exports.isNearLimit = isNearLimit;
exports.isAtLimit = isAtLimit;
exports.getUpgradePlanFor = getUpgradePlanFor;
var UNLIMITED = 999999999;
exports.PLAN_PRICES = {
    foundation: 799,
    growth: 1399,
    commercial: 2299,
    enterprise: 3799,
};
exports.PLAN_LIMITS = {
    foundation: {
        contacts: { max: 500, period: "total" },
        accounts: { max: 100, period: "total" },
        leads: { max: 200, period: "total" },
        opportunities: { max: 100, period: "total" },
        products: { max: 50, period: "total" },
        quotes: { max: 50, period: "monthly" },
        documents: { max: 100, period: "total" },
        document_templates: { max: 10, period: "total" },
        storage_mb: { max: 1024, period: "total" },
        api_calls: { max: 1000, period: "daily" },
        esignatures: { max: 10, period: "monthly" },
    },
    growth: {
        contacts: { max: 5000, period: "total" },
        accounts: { max: 1000, period: "total" },
        leads: { max: 2000, period: "total" },
        opportunities: { max: 1000, period: "total" },
        products: { max: 500, period: "total" },
        quotes: { max: 500, period: "monthly" },
        contracts: { max: 100, period: "total" },
        contract_templates: { max: 20, period: "total" },
        documents: { max: 1000, period: "total" },
        document_templates: { max: 100, period: "total" },
        storage_mb: { max: 10240, period: "total" },
        api_calls: { max: 10000, period: "daily" },
        esignatures: { max: 100, period: "monthly" },
    },
    commercial: {
        contacts: { max: 50000, period: "total" },
        accounts: { max: 10000, period: "total" },
        leads: { max: 20000, period: "total" },
        opportunities: { max: 10000, period: "total" },
        products: { max: 5000, period: "total" },
        quotes: { max: 5000, period: "monthly" },
        contracts: { max: 1000, period: "total" },
        contract_templates: { max: 200, period: "total" },
        documents: { max: 10000, period: "total" },
        document_templates: { max: 1000, period: "total" },
        suppliers: { max: 500, period: "total" },
        purchase_orders: { max: 1000, period: "total" },
        storage_mb: { max: 102400, period: "total" },
        api_calls: { max: 100000, period: "daily" },
        esignatures: { max: 1000, period: "monthly" },
    },
    enterprise: {
        contacts: { max: UNLIMITED, period: "total" },
        accounts: { max: UNLIMITED, period: "total" },
        leads: { max: UNLIMITED, period: "total" },
        opportunities: { max: UNLIMITED, period: "total" },
        products: { max: UNLIMITED, period: "total" },
        quotes: { max: UNLIMITED, period: "monthly" },
        contracts: { max: UNLIMITED, period: "total" },
        contract_templates: { max: UNLIMITED, period: "total" },
        documents: { max: UNLIMITED, period: "total" },
        document_templates: { max: UNLIMITED, period: "total" },
        suppliers: { max: UNLIMITED, period: "total" },
        purchase_orders: { max: UNLIMITED, period: "total" },
        storage_mb: { max: 512000, period: "total" },
        api_calls: { max: UNLIMITED, period: "daily" },
        esignatures: { max: UNLIMITED, period: "monthly" },
    },
};
function getLimit(plan, resource) {
    var _a, _b;
    return (_b = (_a = exports.PLAN_LIMITS[plan]) === null || _a === void 0 ? void 0 : _a[resource]) !== null && _b !== void 0 ? _b : null;
}
function isUnlimited(max) {
    return max >= UNLIMITED;
}
function getUsagePercent(current, max) {
    if (isUnlimited(max))
        return 0;
    if (max <= 0)
        return 100;
    return Math.min(100, Math.round((current / max) * 100));
}
function isNearLimit(current, max, thresholdPercent) {
    if (thresholdPercent === void 0) { thresholdPercent = 80; }
    if (isUnlimited(max))
        return false;
    return getUsagePercent(current, max) >= thresholdPercent;
}
function isAtLimit(current, max) {
    if (isUnlimited(max))
        return false;
    return current >= max;
}
function getUpgradePlanFor(currentPlan) {
    switch (currentPlan) {
        case "foundation":
            return "growth";
        case "growth":
            return "commercial";
        case "commercial":
            return "enterprise";
        case "enterprise":
            return null;
    }
}
