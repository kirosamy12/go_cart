import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../../../DB/models/user.model.js';
import storeModel from '../../../DB/models/store.model.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Generate unique ID
const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: "932906548265-dokggk5aqkdednbvp1ttbq3ad5mt94f2.apps.googleusercontent.com",
  clientSecret:"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",
  callbackURL: "https://go-cart-1bwm.vercel.app/api/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with Google ID
    let user = await userModel.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user);
    }
    
    // Check if user exists with the same email
    user = await userModel.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Update existing user with Google ID
      user.googleId = profile.id;
      user.image = profile.photos[0].value;
      await user.save();
      return done(null, user);
    }
    
    // Create new user
    const newUser = new userModel({
      id: generateId(),
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      image: profile.photos[0].value,
      password: '', // No password for Google auth users
      cart: {}
    });
    
    await newUser.save();
    
    return done(null, newUser);
  } catch (error) {
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findOne({ id: id });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;