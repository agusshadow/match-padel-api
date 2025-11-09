import { supabase } from '../config/supabase.js';

export const uploadProfilePicture = async (userId, file) => {
  const fileExt = file.originalname.split('.').pop();
  const fileName = `user-${userId}-${Date.now()}.${fileExt}`;
  const filePath = `profile-pictures/${fileName}`;

  // Subir archivo a Supabase Storage
  const { data, error } = await supabase.storage
    .from('profile-pictures')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};

