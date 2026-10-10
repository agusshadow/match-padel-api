import { Router } from 'express'
import { uploadCatalogAsset } from '../../middleware/upload'
import * as controller from './catalogs.controller'

// Mounted by platform.router.ts under /catalogs, behind requireAuth, loadAccess
// and requireRole(['superadmin']): a reviewer or any club role gets 403.
const router = Router()

router.post('/assets', uploadCatalogAsset, controller.uploadAsset)

router.get('/achievements', controller.listAchievements)
router.post('/achievements', controller.createAchievement)
router.get('/achievements/:id', controller.getAchievement)
router.patch('/achievements/:id', controller.updateAchievement)
router.post('/achievements/:id/activate', controller.setAchievementActive(true))
router.post('/achievements/:id/deactivate', controller.setAchievementActive(false))

router.get('/challenges', controller.listChallenges)
router.post('/challenges', controller.createChallenge)
router.get('/challenges/:id', controller.getChallenge)
router.patch('/challenges/:id', controller.updateChallenge)
router.post('/challenges/:id/activate', controller.setChallengeActive(true))
router.post('/challenges/:id/deactivate', controller.setChallengeActive(false))

router.get('/cosmetics', controller.listCosmetics)
router.post('/cosmetics', controller.createCosmetic)
router.get('/cosmetics/:id', controller.getCosmetic)
router.patch('/cosmetics/:id', controller.updateCosmetic)
router.post('/cosmetics/:id/activate', controller.setCosmeticActive(true))
router.post('/cosmetics/:id/deactivate', controller.setCosmeticActive(false))

export default router
