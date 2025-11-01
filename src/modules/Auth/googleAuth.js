import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../../../DB/models/user.model.js';
import dotenv from 'dotenv';

dotenv.config(); // تحميل متغيرات البيئة تلقائيًا

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const initGoogleAuth = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await userModel.findOne({ googleId: profile.id });

          if (user) return done(null, user);

          user = await userModel.findOne({ email: profile.emails[0].value });
          if (user) {
            user.googleId = profile.id;
            user.image = profile.photos?.[0]?.value;
            await user.save();
            return done(null, user);
          }

          const newUser = new userModel({
            id: generateId(),
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            image: profile.photos?.[0]?.value,
            password: '',
            cart: {},
          });

          await newUser.save();
          return done(null, newUser);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
};

// Session handling
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
