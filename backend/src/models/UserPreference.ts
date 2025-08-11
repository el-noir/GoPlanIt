import mongoose, {Document, Schema} from "mongoose";

export interface ITravelDates{
    start: Date;
    end: Date;
}

export interface IUserPreference extends Document{
    userId: string;
    email: string;
    travelDates: ITravelDates;
    budget: number;
    interests: string[];
    transportPreferences: string[];
    accommodationPreferences: string[];
    createdAt: Date
}

const TravelDatesSchema: Schema = new Schema({
    start: {type: Date, required: true},
    end: {type: Date, required: true}
})

const UserPreferenceSchema: Schema = new Schema({
    userId: {type: String, required: true},
    email: { type: String, required: true },
    travelDates: { type: TravelDatesSchema, required: true },
    budget: { type: Number, required: true },
    interests: { type: [String], required: true },
    transportPreferences: { type: [String], required: true },
    accommodationPreferences: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
})

const UserPreference = mongoose.model<IUserPreference>('UserPreference', UserPreferenceSchema);

export default UserPreference