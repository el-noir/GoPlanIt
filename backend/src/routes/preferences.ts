import { Router } from "express"
import { UserPreferenceController } from "../controllers/UserPreferenceController.js"

const router = Router()

router.post("/", UserPreferenceController.createPreference)
router.get("/:id", UserPreferenceController.getPreference)
router.get("/:id/status", UserPreferenceController.getProcessingStatus)

router.get("/user/:userId", UserPreferenceController.getUserPreferences)
router.put("/:id", UserPreferenceController.updatePreference)

export default router
