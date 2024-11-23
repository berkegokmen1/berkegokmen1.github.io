import cv2
from moviepy.editor import VideoFileClip

def split_video_into_quadrants(video_path, output_prefix):
    # Load the video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Check that the video is at least 4 seconds long
    if duration < 4:
        print("Error: Video must be at least 4 seconds long.")
        return
    
    # Calculate the center point and crop dimensions
    half_width = width // 2
    half_height = height // 2
    
    # Define the start and end times (4 seconds each)
    start_time = 0
    end_time = 4  # duration in seconds for each segment
    
    # Read the video and create clips for each quadrant
    clip = VideoFileClip(video_path).subclip(start_time, end_time)
    
    # Define the coordinates for each quadrant
    quadrants = {
        "up_left": (0, 0, half_width, half_height),
        "up_right": (half_width, 0, width, half_height),
        "down_left": (0, half_height, half_width, height),
        "down_right": (half_width, half_height, width, height)
    }
    
    # Process and save each quadrant
    for quadrant, (x1, y1, x2, y2) in quadrants.items():
        cropped_clip = clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
        cropped_clip.write_videofile(f"{output_prefix}_{quadrant}.mp4", fps=fps)

    # Release resources
    cap.release()
    print("Quadrant videos have been saved.")

# Example usage:
split_video_into_quadrants("grid_2.mp4", "output_video")
