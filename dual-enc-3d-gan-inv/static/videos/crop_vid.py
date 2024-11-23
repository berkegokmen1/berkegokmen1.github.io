from moviepy.editor import VideoFileClip

# Load the video
input_path = "comparison_with_titles.mp4"  # Replace with your video file path
output_path = "output_cropped.mp4"

# Open the video clip
clip = VideoFileClip(input_path)

# Calculate new height after removing 3 * 512 pixels from the bottom
new_height = clip.h - 5 * 512

# Crop the video
cropped_clip = clip.crop(y1=0, y2=new_height)

# Write the cropped video to the output file
cropped_clip.write_videofile(output_path, codec="libx264")

