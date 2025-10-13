import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

const connection = async () => {
  try {
    await mongoose.connect("mongodb+srv://kirellossamy8_db_user:QLdeolE5SUHgu0dF@cluster0.fobtndf.mongodb.net/kiroecommerce", {
  
    });
    console.log('db connected successfully');
  } catch (err) {
    console.error('db connection failed', err);
  }
};

export default connection;
