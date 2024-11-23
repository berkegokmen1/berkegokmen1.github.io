

from moviepy.editor import VideoFileClip, clips_array

# Load the video
input_path = "comparison_with_titles.mp4"  # Replace with your video file path
output_path = "output_stitched.mp4"

# Open the video clip
clip = VideoFileClip(input_path)

# Crop the first 100 pixels from the top
top_part = clip.crop(y1=0, y2=100)

# Crop the last 2560 pixels from the bottom
start_last_part = clip.h - 5 * 512
bottom_part = clip.crop(y1=start_last_part, y2=clip.h - 512)

# Stitch the clips vertically
stitched_clip = clips_array([[top_part], [bottom_part]])

# Write the stitched video to the output file
stitched_clip.write_videofile(output_path, codec="libx264")
