"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const batch_controller_1 = require("./batch.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const router = (0, express_1.Router)();
// List & Get Details
router.get('/', auth_middleware_1.authMiddleware, batch_controller_1.BatchController.list);
router.get('/:id', auth_middleware_1.authMiddleware, batch_controller_1.BatchController.getById);
// Training Centre actions
router.post('/', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['TRAINING_CENTRE']), batch_controller_1.BatchController.create);
router.post('/:id/upload-csv', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['TRAINING_CENTRE']), upload_middleware_1.uploadCsv.single('file'), batch_controller_1.BatchController.uploadCsv);
router.post('/:id/submit', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['TRAINING_CENTRE']), batch_controller_1.BatchController.submit);
router.post('/:id/resubmit', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['TRAINING_CENTRE']), batch_controller_1.BatchController.resubmit);
// Approval actions
router.post('/:id/district-decision', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['DISTRICT_OFFICER', 'STATE_OFFICE']), batch_controller_1.BatchController.districtDecision);
router.post('/:id/quality-decision', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['QUALITY_TEAM', 'STATE_OFFICE']), batch_controller_1.BatchController.qualityDecision);
router.post('/:id/state-decision', auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)(['STATE_OFFICE']), batch_controller_1.BatchController.stateDecision);
exports.default = router;
