import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

const connection = async () => {
  try {
    await mongoose.connect("mongodb+srv://kirellossamy8_db_user:QLdeolE5SUHgu0dF@cluster0.fobtndf.mongodb.net/kiroecommerce?retryWrites=true&w=majority&appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000 // مهلة الاتصال 10 ثواني
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1); // خروج فوري لو الاتصال فشل
  }
};

export default connection;
